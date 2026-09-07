import "server-only";

import { and, count, desc, eq, gt, ilike, inArray, isNull, or, sql } from "drizzle-orm";

import type {
  AdminGroupMember,
  AdminGroupMemberStatusFilter,
  AuthGroupSwitchOption,
  AccountInfo,
  BankRecord,
  Group,
  GroupInvite,
  GroupMembership,
  PostMedia,
  PostComment,
  PendingGroupJoinRequest,
  Season,
  SeasonParticipant,
  Settlement,
  SettlementRow,
  User,
  UserGroupMembership,
  WorkoutPost,
} from "@/domain/models";
import { getCurrentGroupIdForUser, requireCurrentUserId } from "@/auth/session";
import { isInviteTokenFormat } from "@/invites/tokens";
import type { OunwanAppData } from "@/domain/app-data";
import { db } from "./client";
import { ActiveSeasonNotFoundError, CurrentUserMembershipNotFoundError } from "./errors";
import {
  bankAccounts,
  bankBalanceRecords,
  groupInvites,
  groupJoinRequests,
  groupMembers,
  groups,
  oauthAccounts,
  postComments,
  postLikes,
  postMedia,
  seasons,
  seasonParticipantPeriods,
  users,
  weeklySettlementRows,
  weeklySettlements,
  workoutPosts,
} from "./schema";


export async function getOunwanAppData(): Promise<OunwanAppData> {
  const currentUser = await getCurrentUser();
  const approvedGroups = await getApprovedGroupMemberships(currentUser.id);
  const selectedGroupId = await getCurrentGroupIdForUser(currentUser.id);
  const selectedGroup = approvedGroups.find(({ group }) => group.id === selectedGroupId) ?? approvedGroups[0];

  if (!selectedGroup) {
    throw new CurrentUserMembershipNotFoundError();
  }

  const group = selectedGroup.group;
  const membership = selectedGroup.membership;
  const season = await getActiveSeason(group.id);
  const isAdmin = membership.roles.includes("admin");
  const [appUsers, groupSeasons, seasonParticipants, adminGroupMembers, posts, settlement, bankRecords, accountInfo] = await Promise.all([
    getGroupUsers(group.id),
    getGroupSeasons(group.id),
    getSeasonParticipants(group.id),
    isAdmin ? getAdminGroupMembers({ status: "all" }) : Promise.resolve([]),
    getWorkoutPosts(group.id, season.id, currentUser.id),
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
    currentUser,
    approvedGroups,
    adminGroupMembers,
    users: appUsers,
    group,
    membership,
    season,
    seasons: groupSeasons,
    seasonParticipants,
    posts,
    settlement,
    settlementRows,
    bankRecords,
    accountInfo,
  };
}

export type GetAdminGroupMembersInput = {
  status?: AdminGroupMemberStatusFilter;
  keyword?: string;
};

export async function getAdminGroupMembers(input: GetAdminGroupMembersInput = {}): Promise<AdminGroupMember[]> {
  const context = await getCurrentAdminGroupContext();
  const status = input.status ?? "approved";
  const keyword = input.keyword?.trim();

  if (status === "all") {
    const [approvedMembers, pendingMembers] = await Promise.all([
      getApprovedGroupMembers(context.groupId, keyword),
      getPendingGroupMembers(context.groupId, keyword),
    ]);

    return [...approvedMembers, ...pendingMembers];
  }

  if (status === "pending") {
    return getPendingGroupMembers(context.groupId, keyword);
  }

  return getApprovedGroupMembers(context.groupId, keyword);
}



export async function getCurrentUserGroupSwitchOptions(): Promise<AuthGroupSwitchOption[]> {
  const currentUserId = await requireCurrentUserId();
  const selectedGroupId = await getCurrentGroupIdForUser(currentUserId);
  const rows = await db
    .select({ group: groups, member: groupMembers, activeSeasonId: seasons.id })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .leftJoin(seasons, and(eq(seasons.groupId, groups.id), eq(seasons.status, "active")))
    .where(and(eq(groupMembers.userId, BigInt(currentUserId)), isNull(groupMembers.leftAt), isNull(groups.deletedAt)))
    .orderBy(desc(groupMembers.updatedAt), desc(groups.id));

  return rows.map(({ group, member, activeSeasonId }) => ({
    group: {
      id: group.id.toString(),
      name: group.name,
      visibility: group.visibility,
      ownerUserId: group.ownerUserId.toString(),
    },
    membership: {
      groupId: member.groupId.toString(),
      userId: member.userId.toString(),
      roles: member.roles,
      joinedAt: member.joinedAt,
      leftAt: member.leftAt ?? undefined,
    },
    hasActiveSeason: Boolean(activeSeasonId),
    isCurrent: group.id.toString() === selectedGroupId,
  }));
}
export async function getCurrentUserPendingGroupJoinRequests(): Promise<PendingGroupJoinRequest[]> {
  const currentUserId = await requireCurrentUserId();
  const rows = await db
    .select({ request: groupJoinRequests, group: groups })
    .from(groupJoinRequests)
    .innerJoin(groups, eq(groupJoinRequests.groupId, groups.id))
    .where(
      and(
        eq(groupJoinRequests.userId, BigInt(currentUserId)),
        eq(groupJoinRequests.status, "pending"),
        isNull(groups.deletedAt),
      ),
    )
    .orderBy(desc(groupJoinRequests.requestedAt), desc(groupJoinRequests.id));

  return rows.map(({ request, group }) => ({
    id: request.id.toString(),
    group: {
      id: group.id.toString(),
      name: group.name,
      visibility: group.visibility,
      ownerUserId: group.ownerUserId.toString(),
    },
    requestedAt: request.requestedAt.toISOString(),
    requestId: request.id.toString(),
  }));
}
export async function getValidGroupInviteByToken(inviteToken: string): Promise<GroupInvite | undefined> {
  const trimmedToken = inviteToken.trim();

  if (!isInviteTokenFormat(trimmedToken)) {
    return undefined;
  }

  const now = new Date();
  const rows = await db
    .select({
      invite: groupInvites,
      group: groups,
      createdByUser: users,
      createdByKakaoId: oauthAccounts.providerUserId,
    })
    .from(groupInvites)
    .innerJoin(groups, eq(groupInvites.groupId, groups.id))
    .innerJoin(users, eq(groupInvites.createdByUserId, users.id))
    .leftJoin(oauthAccounts, and(eq(oauthAccounts.userId, users.id), eq(oauthAccounts.provider, "kakao")))
    .where(
      and(
        eq(groupInvites.inviteToken, trimmedToken),
        eq(groupInvites.status, "active"),
        isNull(groups.deletedAt),
        isNull(users.deletedAt),
        gt(groupInvites.expiresAt, now),
        or(isNull(groupInvites.maxUses), sql`${groupInvites.usedCount} < ${groupInvites.maxUses}`),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return undefined;
  }

  return {
    id: row.invite.id.toString(),
    group: {
      id: row.group.id.toString(),
      name: row.group.name,
      visibility: row.group.visibility,
      ownerUserId: row.group.ownerUserId.toString(),
    },
    createdByUser: {
      id: row.createdByUser.id.toString(),
      kakaoId: row.createdByKakaoId ?? "",
      name: row.createdByUser.displayName,
      avatarUrl: row.createdByUser.avatarStorageKey ? `/uploads/${row.createdByUser.avatarStorageKey}?v=${row.createdByUser.updatedAt.getTime()}` : undefined,
    },
    inviteToken: row.invite.inviteToken,
    expiresAt: row.invite.expiresAt?.toISOString(),
    maxUses: row.invite.maxUses ?? undefined,
    usedCount: row.invite.usedCount,
    status: row.invite.status,
  };
}

async function getApprovedGroupMembers(groupId: string, keyword?: string): Promise<AdminGroupMember[]> {
  const conditions = [eq(groupMembers.groupId, BigInt(groupId)), isNull(groupMembers.leftAt), isNull(users.deletedAt)];
  const searchCondition = createUserSearchCondition(keyword);

  if (searchCondition) {
    conditions.push(searchCondition);
  }

  const rows = await db
    .select({ member: groupMembers, user: users, kakaoId: oauthAccounts.providerUserId })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .leftJoin(oauthAccounts, and(eq(oauthAccounts.userId, users.id), eq(oauthAccounts.provider, "kakao")))
    .where(and(...conditions))
    .orderBy(groupMembers.joinedAt, users.displayName, users.id);

  return rows.map(({ member, user, kakaoId }) => ({
    id: `approved:${member.groupId.toString()}:${member.userId.toString()}`,
    status: "approved",
    user: toUser(user, kakaoId),
    roles: member.roles,
    joinedAt: member.joinedAt,
    leftAt: member.leftAt ?? undefined,
  }));
}

async function getPendingGroupMembers(groupId: string, keyword?: string): Promise<AdminGroupMember[]> {
  const conditions = [eq(groupJoinRequests.groupId, BigInt(groupId)), eq(groupJoinRequests.status, "pending"), isNull(users.deletedAt)];
  const searchCondition = createUserSearchCondition(keyword);

  if (searchCondition) {
    conditions.push(searchCondition);
  }

  const rows = await db
    .select({ request: groupJoinRequests, user: users, kakaoId: oauthAccounts.providerUserId })
    .from(groupJoinRequests)
    .innerJoin(users, eq(groupJoinRequests.userId, users.id))
    .leftJoin(oauthAccounts, and(eq(oauthAccounts.userId, users.id), eq(oauthAccounts.provider, "kakao")))
    .where(and(...conditions))
    .orderBy(desc(groupJoinRequests.requestedAt), users.displayName, users.id);

  return rows.map(({ request, user, kakaoId }) => ({
    id: `pending:${request.id.toString()}`,
    status: "pending",
    user: toUser(user, kakaoId),
    roles: [],
    requestedAt: request.requestedAt.toISOString(),
    requestId: request.id.toString(),
  }));
}

async function getCurrentAdminGroupContext() {
  const userId = await requireCurrentUserId();
  const selectedGroupId = await getCurrentGroupIdForUser(userId);
  const membershipRows = await db
    .select({ groupId: groupMembers.groupId, roles: groupMembers.roles })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(and(eq(groupMembers.userId, BigInt(userId)), isNull(groupMembers.leftAt), isNull(groups.deletedAt)))
    .orderBy(desc(groupMembers.updatedAt), desc(groups.id));
  const membership = membershipRows.find((row) => row.groupId.toString() === selectedGroupId) ?? membershipRows[0];

  if (!membership) {
    throw new CurrentUserMembershipNotFoundError();
  }

  if (!membership.roles.includes("admin")) {
    throw new Error("Only admins can read group members.");
  }

  return { userId, groupId: membership.groupId.toString(), roles: membership.roles };
}

function createUserSearchCondition(keyword?: string) {
  if (!keyword) {
    return undefined;
  }

  const pattern = `%${keyword}%`;
  return or(ilike(users.displayName, pattern), ilike(oauthAccounts.providerUserId, pattern), sql`${users.id}::text ILIKE ${pattern}`);
}
async function getCurrentUser(): Promise<User> {
  const currentUserId = await requireCurrentUserId();
  const rows = await db
    .select({
      id: users.id,
      kakaoId: oauthAccounts.providerUserId,
      displayName: users.displayName,
      avatarStorageKey: users.avatarStorageKey,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .leftJoin(oauthAccounts, eq(oauthAccounts.userId, users.id))
    .where(and(eq(users.id, BigInt(currentUserId)), eq(users.status, "active"), isNull(users.deletedAt)))
    .limit(1);

  if (!rows[0]) {
    throw new Error("Current user not found.");
  }

  return toUser(rows[0], rows[0].kakaoId);
}

function toUser(
  user: Pick<typeof users.$inferSelect, "id" | "displayName" | "avatarStorageKey" | "updatedAt">,
  kakaoId?: string | null,
): User {
  return {
    id: user.id.toString(),
    kakaoId: kakaoId ?? "",
    name: user.displayName,
    avatarUrl: user.avatarStorageKey ? `/uploads/${user.avatarStorageKey}?v=${user.updatedAt.getTime()}` : undefined,
  };
}

async function getApprovedGroupMemberships(currentUserId: string): Promise<UserGroupMembership[]> {
  const rows = await db
    .select({ group: groups, member: groupMembers })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(and(eq(groupMembers.userId, BigInt(currentUserId)), isNull(groupMembers.leftAt), isNull(groups.deletedAt)))
    .orderBy(desc(groupMembers.updatedAt), desc(groups.id));

  return rows.map(({ group, member }) => ({
    group: {
      id: group.id.toString(),
      name: group.name,
      visibility: group.visibility,
      ownerUserId: group.ownerUserId.toString(),
    },
    membership: {
      groupId: member.groupId.toString(),
      userId: member.userId.toString(),
      roles: member.roles,
      joinedAt: member.joinedAt,
      leftAt: member.leftAt ?? undefined,
    },
  }));
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
    throw new ActiveSeasonNotFoundError();
  }

  return toSeason(rows[0]);
}

async function getGroupSeasons(groupId: string): Promise<Season[]> {
  const rows = await db
    .select()
    .from(seasons)
    .where(eq(seasons.groupId, BigInt(groupId)))
    .orderBy(desc(seasons.startDate), desc(seasons.id));

  return rows.map(toSeason);
}

async function getSeasonParticipants(groupId: string): Promise<SeasonParticipant[]> {
  const rows = await db
    .select({ period: seasonParticipantPeriods, user: users, kakaoId: oauthAccounts.providerUserId })
    .from(seasonParticipantPeriods)
    .innerJoin(seasons, eq(seasonParticipantPeriods.seasonId, seasons.id))
    .innerJoin(users, eq(seasonParticipantPeriods.userId, users.id))
    .leftJoin(oauthAccounts, eq(oauthAccounts.userId, users.id))
    .where(and(eq(seasons.groupId, BigInt(groupId)), isNull(users.deletedAt)))
    .orderBy(desc(seasons.startDate), seasonParticipantPeriods.startDate, users.id);

  return rows.map(({ period, user, kakaoId }) => ({
    id: period.id.toString(),
    seasonId: period.seasonId.toString(),
    user: {
      id: user.id.toString(),
      kakaoId: kakaoId ?? "",
      name: user.displayName,
      avatarUrl: user.avatarStorageKey ? `/uploads/${user.avatarStorageKey}?v=${user.updatedAt.getTime()}` : undefined,
    },
    startDate: period.startDate,
    endDate: period.endDate ?? undefined,
  }));
}

function toSeason(row: typeof seasons.$inferSelect): Season {
  return {
    id: row.id.toString(),
    groupId: row.groupId.toString(),
    name: row.name,
    startDate: row.startDate,
    endDate: row.endDate ?? undefined,
    targetWorkoutCountPerWeek: row.targetWorkoutCountPerWeek,
    finePerMiss: row.finePerMiss,
    status: row.status,
  };
}

async function getGroupUsers(groupId: string): Promise<User[]> {
  const rows = await db
    .select({
      id: users.id,
      kakaoId: oauthAccounts.providerUserId,
      displayName: users.displayName,
      avatarStorageKey: users.avatarStorageKey,
      updatedAt: users.updatedAt,
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
    avatarUrl: row.avatarStorageKey ? `/uploads/${row.avatarStorageKey}?v=${row.updatedAt.getTime()}` : undefined,
  }));
}

async function getWorkoutPosts(groupId: string, seasonId: string, currentUserId: string): Promise<WorkoutPost[]> {
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
  const commentsByPostId = new Map<string, PostComment[]>();
  const commentCounts = new Map<string, number>();
  const currentUserLikedPostIds = new Set<string>();
  const likeUserIdsByPostId = new Map<string, string[]>();

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
        url: media.url ?? `/uploads/${media.storageKey}`,
        thumbnailUrl: media.thumbnailUrl ?? undefined,
        sortOrder: media.sortOrder,
      });
      mediaByPostId.set(postId, list);
    }

    const commentRows = await db
      .select()
      .from(postComments)
      .where(and(inArray(postComments.postId, postIds), isNull(postComments.deletedAt)))
      .orderBy(postComments.postId, postComments.createdAt);

    for (const comment of commentRows) {
      const postId = comment.postId.toString();
      const list = commentsByPostId.get(postId) ?? [];
      list.push({
        id: comment.id.toString(),
        postId,
        userId: comment.userId.toString(),
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
      });
      commentsByPostId.set(postId, list);
    }

    for (const [postId, comments] of commentsByPostId) {
      commentCounts.set(postId, comments.length);
    }

    const currentUserLikeRows = await db
      .select({ postId: postLikes.postId })
      .from(postLikes)
      .where(and(inArray(postLikes.postId, postIds), eq(postLikes.userId, BigInt(currentUserId))));

    for (const row of currentUserLikeRows) {
      currentUserLikedPostIds.add(row.postId.toString());
    }

    const likeRows = await db
      .select({ postId: postLikes.postId, userId: postLikes.userId })
      .from(postLikes)
      .where(inArray(postLikes.postId, postIds))
      .orderBy(postLikes.postId, desc(postLikes.createdAt));

    for (const like of likeRows) {
      const postId = like.postId.toString();
      const list = likeUserIdsByPostId.get(postId) ?? [];
      list.push(like.userId.toString());
      likeUserIdsByPostId.set(postId, list);
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
      workoutType: post.workoutType ?? undefined,
      isInvalid: post.isInvalid,
      invalidatedByUserId: post.invalidatedByUserId?.toString(),
      invalidatedAt: post.invalidatedAt?.toISOString(),
      likeCount,
      likedByCurrentUser: currentUserLikedPostIds.has(postId),
      likeUserIds: likeUserIdsByPostId.get(postId) ?? [],
      commentCount: commentCounts.get(postId) ?? 0,
      comments: commentsByPostId.get(postId) ?? [],
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
    imageUrl: row.imageUrl ?? `/uploads/${row.imageStorageKey}`,
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
