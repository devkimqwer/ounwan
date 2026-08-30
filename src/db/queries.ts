import "server-only";

import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";

import type {
  AccountInfo,
  BankRecord,
  Group,
  GroupMembership,
  PostMedia,
  Season,
  Settlement,
  SettlementRow,
  User,
  WorkoutPost,
} from "@/domain/models";
import type { OunwanAppData } from "@/domain/app-data";
import { db } from "./client";
import {
  bankAccounts,
  bankBalanceRecords,
  groupMembers,
  groups,
  oauthAccounts,
  postComments,
  postLikes,
  postMedia,
  seasons,
  users,
  weeklySettlementRows,
  weeklySettlements,
  workoutPosts,
} from "./schema";

const seedCurrentKakaoId = "kakao-1";

export async function getOunwanAppData(): Promise<OunwanAppData> {
  const currentUser = await getCurrentSeedUser();
  const membership = await getCurrentMembership(currentUser.id);
  const group = await getGroup(membership.groupId);
  const season = await getActiveSeason(group.id);
  const [appUsers, posts, settlement, bankRecords, accountInfo] = await Promise.all([
    getGroupUsers(group.id),
    getWorkoutPosts(group.id, season.id),
    getLatestSettlement(group.id, season.id),
    getBankRecords(group.id),
    getAccountInfo(group.id),
  ]);
  const settlementRows = settlement ? await getSettlementRows(settlement.id) : [];

  if (!settlement) {
    throw new Error("No settlement found. Run npm run db:seed:local first.");
  }

  return {
    currentUserId: currentUser.id,
    currentGroupId: group.id,
    currentSeasonId: season.id,
    users: appUsers,
    group,
    membership,
    season,
    posts,
    settlement,
    settlementRows,
    bankRecords,
    accountInfo,
  };
}

async function getCurrentSeedUser() {
  const rows = await db
    .select({ id: users.id })
    .from(oauthAccounts)
    .innerJoin(users, eq(oauthAccounts.userId, users.id))
    .where(and(eq(oauthAccounts.provider, "kakao"), eq(oauthAccounts.providerUserId, seedCurrentKakaoId)))
    .limit(1);

  if (!rows[0]) {
    throw new Error("Seed current user not found. Run npm run db:seed:local first.");
  }

  return { id: rows[0].id.toString() };
}

async function getCurrentMembership(currentUserId: string): Promise<GroupMembership> {
  const rows = await db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.userId, BigInt(currentUserId)), isNull(groupMembers.leftAt)))
    .limit(1);

  if (!rows[0]) {
    throw new Error("Current user membership not found. Run npm run db:seed:local first.");
  }

  return {
    groupId: rows[0].groupId.toString(),
    userId: rows[0].userId.toString(),
    roles: rows[0].roles,
    joinedAt: rows[0].joinedAt,
    leftAt: rows[0].leftAt ?? undefined,
  };
}

async function getGroup(groupId: string): Promise<Group> {
  const rows = await db.select().from(groups).where(eq(groups.id, BigInt(groupId))).limit(1);

  if (!rows[0]) {
    throw new Error("Group not found.");
  }

  return {
    id: rows[0].id.toString(),
    name: rows[0].name,
    visibility: rows[0].visibility,
    ownerUserId: rows[0].ownerUserId.toString(),
  };
}

async function getActiveSeason(groupId: string): Promise<Season> {
  const rows = await db
    .select()
    .from(seasons)
    .where(and(eq(seasons.groupId, BigInt(groupId)), eq(seasons.status, "active")))
    .limit(1);

  if (!rows[0]) {
    throw new Error("Active season not found. Run npm run db:seed:local first.");
  }

  return {
    id: rows[0].id.toString(),
    groupId: rows[0].groupId.toString(),
    name: rows[0].name,
    startDate: rows[0].startDate,
    endDate: rows[0].endDate ?? undefined,
    targetWorkoutCountPerWeek: rows[0].targetWorkoutCountPerWeek,
    finePerMiss: rows[0].finePerMiss,
    status: rows[0].status,
  };
}

async function getGroupUsers(groupId: string): Promise<User[]> {
  const rows = await db
    .select({
      id: users.id,
      kakaoId: oauthAccounts.providerUserId,
      displayName: users.displayName,
      avatarColor: users.avatarColor,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .innerJoin(oauthAccounts, eq(oauthAccounts.userId, users.id))
    .where(and(eq(groupMembers.groupId, BigInt(groupId)), isNull(groupMembers.leftAt)))
    .orderBy(groupMembers.joinedAt, users.id);

  return rows.map((row) => ({
    id: row.id.toString(),
    kakaoId: row.kakaoId,
    name: row.displayName,
    avatarColor: row.avatarColor ?? "#5e4ea5",
  }));
}

async function getWorkoutPosts(groupId: string, seasonId: string): Promise<WorkoutPost[]> {
  const rows = await db
    .select({
      post: workoutPosts,
      likeCount: count(postLikes.userId),
    })
    .from(workoutPosts)
    .leftJoin(postLikes, eq(postLikes.postId, workoutPosts.id))
    .where(
      and(
        eq(workoutPosts.groupId, BigInt(groupId)),
        eq(workoutPosts.seasonId, BigInt(seasonId)),
        isNull(workoutPosts.deletedAt),
      ),
    )
    .groupBy(workoutPosts.id)
    .orderBy(desc(workoutPosts.createdAt));

  const postIds = rows.map((row) => row.post.id);
  const mediaByPostId = new Map<string, PostMedia[]>();
  const commentCounts = new Map<string, number>();

  if (postIds.length > 0) {
    const mediaRows = await db
      .select()
      .from(postMedia)
      .where(inArray(postMedia.postId, postIds))
      .orderBy(postMedia.postId, postMedia.sortOrder);

    for (const media of mediaRows) {
      const postId = media.postId.toString();
      const list = mediaByPostId.get(postId) ?? [];
      list.push({
        id: media.id.toString(),
        postId,
        type: media.mediaType,
        url: media.url ?? `/${media.storageKey}`,
        thumbnailUrl: media.thumbnailUrl ?? undefined,
        sortOrder: media.sortOrder,
      });
      mediaByPostId.set(postId, list);
    }

    const commentRows = await db
      .select({ postId: postComments.postId, value: count(postComments.id) })
      .from(postComments)
      .where(and(inArray(postComments.postId, postIds), isNull(postComments.deletedAt)))
      .groupBy(postComments.postId);

    for (const row of commentRows) {
      commentCounts.set(row.postId.toString(), row.value);
    }
  }

  return rows.map(({ post, likeCount }) => {
    const postId = post.id.toString();
    return {
      id: postId,
      groupId: post.groupId.toString(),
      seasonId: post.seasonId.toString(),
      userId: post.userId.toString(),
      workoutDate: post.workoutDate,
      createdAt: post.createdAt.toISOString(),
      content: post.content ?? undefined,
      workoutType: post.workoutType,
      isInvalid: post.isInvalid,
      invalidatedByUserId: post.invalidatedByUserId?.toString(),
      invalidatedAt: post.invalidatedAt?.toISOString(),
      likeCount,
      commentCount: commentCounts.get(postId) ?? 0,
      media: mediaByPostId.get(postId) ?? [],
    };
  });
}

async function getLatestSettlement(groupId: string, seasonId: string): Promise<Settlement | undefined> {
  const rows = await db
    .select()
    .from(weeklySettlements)
    .where(and(eq(weeklySettlements.groupId, BigInt(groupId)), eq(weeklySettlements.seasonId, BigInt(seasonId))))
    .orderBy(desc(weeklySettlements.weekStartDate))
    .limit(1);

  return rows[0]
    ? {
        id: rows[0].id.toString(),
        groupId: rows[0].groupId.toString(),
        seasonId: rows[0].seasonId.toString(),
        weekStartDate: rows[0].weekStartDate,
        weekEndDate: rows[0].weekEndDate,
        status: rows[0].status,
        confirmedAt: rows[0].confirmedAt?.toISOString(),
        comment: rows[0].comment ?? undefined,
      }
    : undefined;
}

async function getSettlementRows(settlementId: string): Promise<SettlementRow[]> {
  const rows = await db
    .select()
    .from(weeklySettlementRows)
    .where(eq(weeklySettlementRows.settlementId, BigInt(settlementId)));

  return rows.map((row) => ({
    settlementId: row.settlementId.toString(),
    userId: row.userId.toString(),
    validWorkoutCount: row.validWorkoutCount,
    missedCount: row.missedCount,
    autoFineAmount: row.autoFineAmount,
    finalFineAmount: row.finalFineAmount,
  }));
}

async function getBankRecords(groupId: string): Promise<BankRecord[]> {
  const rows = await db
    .select()
    .from(bankBalanceRecords)
    .where(eq(bankBalanceRecords.groupId, BigInt(groupId)))
    .orderBy(desc(bankBalanceRecords.createdAt));

  return rows.map((row) => ({
    id: row.id.toString(),
    groupId: row.groupId.toString(),
    createdByUserId: row.createdByUserId.toString(),
    createdAt: row.createdAt.toISOString(),
    memo: row.memo ?? undefined,
    imageUrl: row.imageUrl ?? `/${row.imageStorageKey}`,
  }));
}

async function getAccountInfo(groupId: string): Promise<AccountInfo> {
  const rows = await db.select().from(bankAccounts).where(eq(bankAccounts.groupId, BigInt(groupId))).limit(1);

  if (!rows[0]) {
    throw new Error("Bank account not found. Run npm run db:seed:local first.");
  }

  return {
    groupId: rows[0].groupId.toString(),
    bankName: rows[0].bankName,
    accountNumber: rows[0].accountNumber,
    holderName: rows[0].holderName,
  };
}


