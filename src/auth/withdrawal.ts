import "server-only";

import { and, eq, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { groupJoinRequests, groupMembers, groups, oauthAccounts, pushSubscriptions, seasonParticipantPeriods, users } from "@/db/schema";
import { getKoreanDate } from "@/lib/season-time";
import { getOAuthUnlinkHandler } from "./oauth-unlink";
import { clearPendingKakaoId, clearSession, requireCurrentUserId } from "./session";
import { AccountWithdrawalError } from "@/db/errors";

export async function withdrawCurrentUser() {
  const userId = BigInt(await requireCurrentUserId());
  await db.transaction(async (tx) => {
    // 탈퇴 처리 중 동일 사용자의 중복 요청 및 정보 변경을 방지
    const [user] = await tx
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .for("update"); // 행 잠금
      
    if (!user || user.deletedAt || user.status !== "active") {
      throw new AccountWithdrawalError("탈퇴할 수 있는 계정이 아닙니다.");
    }

    const adminGroups = await tx
      .select({ id: groups.id })
      .from(groups)
      .leftJoin(groupMembers, and(eq(groupMembers.groupId, groups.id), eq(groupMembers.userId, userId), isNull(groupMembers.leftAt)))
      .where(and(isNull(groups.deletedAt), or(
        eq(groups.ownerUserId, userId),
        sql`${groupMembers.roles} @> ARRAY['admin']::member_role[]`,
      )))
      .limit(1);
    if (adminGroups.length) {
      throw new AccountWithdrawalError("관리자인 그룹이 있습니다. 관리자 권한을 위임하거나 그룹을 삭제한 후 탈퇴해주세요.");
    }

    const accounts = await tx
      .select()
      .from(oauthAccounts)
      .where(eq(oauthAccounts.userId, userId))
      .for("update");
    if (!accounts.length) {
      throw new AccountWithdrawalError("연결된 로그인 계정을 확인할 수 없습니다.");
    }
    
    // 일부 계정만 해제되는 상황을 줄이기 위해 모든 공급자의 설정부터 검증한다.
    const targets = accounts.map((account) => ({ account, handler: getOAuthUnlinkHandler(account.provider) }));
    for (const { handler } of targets) {
      handler.validateConfiguration();
    }
    for (const { account, handler } of targets) {
      await handler.unlink(account.providerUserId);
    }

    const now = new Date();
    const today = getKoreanDate(now);
    await tx
      .update(groupMembers)
      .set({ leftAt: sql`greatest(${groupMembers.joinedAt}, ${today}::date)`, updatedAt: now })
      .where(and(eq(groupMembers.userId, userId), isNull(groupMembers.leftAt)));
    await tx
      .update(seasonParticipantPeriods)
      .set({ endDate: sql`greatest(${seasonParticipantPeriods.startDate}, ${today}::date)` })
      .where(and(eq(seasonParticipantPeriods.userId, userId), isNull(seasonParticipantPeriods.endDate)));
    await tx
      .update(groupJoinRequests)
      .set({ status: "cancelled", reviewedAt: now })
      .where(and(eq(groupJoinRequests.userId, userId), eq(groupJoinRequests.status, "pending")));
    await tx
      .update(pushSubscriptions)
      .set({ disabledAt: now, updatedAt: now })
      .where(and(eq(pushSubscriptions.userId, userId), isNull(pushSubscriptions.disabledAt)));
    await tx
      .update(users)
      .set({ status: "deleted", deletedAt: now, updatedAt: now })
      .where(eq(users.id, userId));
  });
  await clearPendingKakaoId();
  await clearSession();
}
