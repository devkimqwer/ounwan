import "server-only";

import { and, count, desc, eq, gt, gte, ilike, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";

import type {
  AdminGroupMember,
  AdminGroupMemberStatusFilter,
  AuthGroupSwitchOption,
  AccountInfo,
  AppNotification,
  BankRecord,
  Group,
  GroupInvite,
  GroupMembership,
  NotificationActionType,
  NotificationPage,
  PostMedia,
  PostComment,
  PendingGroupJoinRequest,
  Season,
  SeasonParticipant,
  Settlement,
  SettlementRow,
  User,
  UserGroupMembership,
  WeeklyUserWorkoutStatus,
  WorkoutPost,
} from "@/domain/models";
import { getCurrentGroupIdForUser, requireCurrentUserId } from "@/auth/session";
import { isInviteTokenFormat } from "@/invites/tokens";
import type { OunwanAppData } from "@/domain/app-data";
import { db } from "./client";
import { CurrentUserMembershipNotFoundError } from "./errors";
import {
  bankAccounts,
  bankBalanceRecords,
  groupInvites,
  groupJoinRequests,
  groupMembers,
  groups,
  notifications,
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
  const [appUsers, groupSeasons, seasonParticipants, adminGroupMembers, posts, weeklyUserWorkoutStatus, settlement, bankRecords, accountInfo, notificationPage] = await Promise.all([
    getGroupUsers(group.id),
    getGroupSeasons(group.id),
    getSeasonParticipants(group.id),
    isAdmin ? getAdminGroupMembers({ status: "all" }) : Promise.resolve([]),
    season ? getWorkoutPosts(group.id, season.id, currentUser.id) : Promise.resolve([]),
    season ? getWeeklyUserWorkoutStatus(group.id, season, currentUser.id) : Promise.resolve(undefined),
    season ? getLatestSettlement(group.id, season) : Promise.resolve(undefined),
    getBankRecords(group.id),
    getAccountInfo(group.id),
    getCurrentUserNotificationPage(),
  ]);
  const settlementRows = settlement?.id ? await getSettlementRows(settlement.id) : [];

  return {
    currentUserId: currentUser.id,
    currentGroupId: group.id,
    currentSeasonId: season?.id,
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
    weeklyUserWorkoutStatus,
    settlement,
    settlementRows,
    bankRecords,
    accountInfo,
    notifications: notificationPage,
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
      getApprovedGroupMembers(context.groupId, keyword, context.userId),
      getPendingGroupMembers(context.groupId, keyword, context.userId),
    ]);

    return [...approvedMembers, ...pendingMembers];
  }

  if (status === "pending") {
    return getPendingGroupMembers(context.groupId, keyword, context.userId);
  }

  return getApprovedGroupMembers(context.groupId, keyword, context.userId);
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
  const groupIds = rows.map(({ group }) => group.id);
  const pendingSeasonRows = groupIds.length
    ? await db
        .select()
        .from(seasons)
        .where(and(inArray(seasons.groupId, groupIds), eq(seasons.status, "pending")))
    : [];
  const pendingSeasonByGroupId = new Map(pendingSeasonRows.map((season) => [season.groupId.toString(), toSeason(season)]));

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
    pendingSeason: pendingSeasonByGroupId.get(group.id.toString()),
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

const NOTIFICATION_PAGE_SIZE = 10;
const notificationActionTypes = new Set<NotificationActionType>(["post_detail", "group_member_management", "settlement_detail"]);

export async function getCurrentUserNotificationPage(offset = 0): Promise<NotificationPage> {
  const currentUserId = await requireCurrentUserId();
  const safeOffset = Math.max(0, Math.trunc(offset));

  const [notificationRows, unreadRows] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(and(eq(notifications.recipientUserId, BigInt(currentUserId)), isNull(notifications.deletedAt)))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(NOTIFICATION_PAGE_SIZE + 1)
      .offset(safeOffset),
    db
      .select({ value: count() })
      .from(notifications)
      .where(and(eq(notifications.recipientUserId, BigInt(currentUserId)), isNull(notifications.deletedAt), isNull(notifications.readAt))),
  ]);

  const pageRows = notificationRows.slice(0, NOTIFICATION_PAGE_SIZE);
  return {
    notifications: pageRows.map(toAppNotification),
    unreadCount: Number(unreadRows[0]?.value ?? 0),
    nextOffset: notificationRows.length > NOTIFICATION_PAGE_SIZE ? safeOffset + NOTIFICATION_PAGE_SIZE : undefined,
  };
}

function toAppNotification(row: typeof notifications.$inferSelect): AppNotification {
  return {
    id: row.id.toString(),
    type: row.type,
    message: row.message,
    actionType: isNotificationActionType(row.actionType) ? row.actionType : undefined,
    actionTargetId: row.actionTargetId ?? undefined,
    readAt: row.readAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function isNotificationActionType(value: string | null): value is NotificationActionType {
  return Boolean(value && notificationActionTypes.has(value as NotificationActionType));
}
async function getApprovedGroupMembers(groupId: string, keyword: string | undefined, currentUserId: string): Promise<AdminGroupMember[]> {
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
    isCurrentUser: member.userId.toString() === currentUserId,
    joinedAt: member.joinedAt,
    leftAt: member.leftAt ?? undefined,
  }));
}

async function getPendingGroupMembers(groupId: string, keyword: string | undefined, currentUserId: string): Promise<AdminGroupMember[]> {
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
    isCurrentUser: request.userId.toString() === currentUserId,
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
  const adminGroupIds = rows.filter(({ member }) => member.roles.includes("admin")).map(({ group }) => group.id);
  const delegateRows = adminGroupIds.length
    ? await db
        .select({ groupId: groupMembers.groupId, user: users, kakaoId: oauthAccounts.providerUserId })
        .from(groupMembers)
        .innerJoin(users, eq(groupMembers.userId, users.id))
        .leftJoin(oauthAccounts, and(eq(oauthAccounts.userId, users.id), eq(oauthAccounts.provider, "kakao")))
        .where(and(inArray(groupMembers.groupId, adminGroupIds), isNull(groupMembers.leftAt), eq(users.status, "active"), isNull(users.deletedAt), ne(groupMembers.userId, BigInt(currentUserId))))
        .orderBy(groupMembers.joinedAt, users.displayName, users.id)
    : [];
  const delegatesByGroupId = new Map<string, User[]>();
  delegateRows.forEach(({ groupId, user, kakaoId }) => {
    const key = groupId.toString();
    const list = delegatesByGroupId.get(key) ?? [];
    list.push(toUser(user, kakaoId));
    delegatesByGroupId.set(key, list);
  });

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
    leaveDelegateCandidates: delegatesByGroupId.get(group.id.toString()) ?? [],
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

async function getActiveSeason(groupId: string): Promise<Season | undefined> {
  const rows = await db
    .select()
    .from(seasons)
    .where(and(eq(seasons.groupId, BigInt(groupId)), eq(seasons.status, "active")))
    .limit(1);

  return rows[0] ? toSeason(rows[0]) : undefined;
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
    weekStartDay: row.weekStartDay,
    dayStartTime: row.dayStartTime,
    dailyDuplicatePolicy: row.dailyDuplicatePolicy,
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

async function getLatestSettlement(groupId: string, season: Season): Promise<Settlement> {
  const rows = await db
    .select()
    .from(weeklySettlements)
    .where(and(eq(weeklySettlements.groupId, BigInt(groupId)), eq(weeklySettlements.seasonId, BigInt(season.id))))
    .orderBy(desc(weeklySettlements.weekStartDate))
    .limit(1);

  if (rows[0]) {
    return {
      id: rows[0].id.toString(),
      groupId: rows[0].groupId.toString(),
      seasonId: rows[0].seasonId.toString(),
      weekStartDate: rows[0].weekStartDate,
      weekEndDate: rows[0].weekEndDate,
      status: rows[0].status,
      confirmedAt: rows[0].confirmedAt?.toISOString(),
      comment: rows[0].comment ?? undefined,
    };
  }

  const weekRange = getKoreanWeekRange(getCurrentKoreanWorkoutDate(season.dayStartTime), season.weekStartDay);
  return {
    id: "",
    groupId,
    seasonId: season.id,
    weekStartDate: weekRange.weekStartDate,
    weekEndDate: weekRange.weekEndDate,
    status: "draft",
  };
}

async function getWeeklyUserWorkoutStatus(groupId: string, season: Season, userId: string): Promise<WeeklyUserWorkoutStatus> {
  const weekRange = getKoreanWeekRange(getCurrentKoreanWorkoutDate(season.dayStartTime), season.weekStartDay);
  const rows = await db
    .select({ workoutDate: workoutPosts.workoutDate })
    .from(workoutPosts)
    .where(
      and(
        eq(workoutPosts.groupId, BigInt(groupId)),
        eq(workoutPosts.seasonId, BigInt(season.id)),
        eq(workoutPosts.userId, BigInt(userId)),
        eq(workoutPosts.isInvalid, false),
        isNull(workoutPosts.deletedAt),
        gte(workoutPosts.workoutDate, weekRange.weekStartDate),
        lte(workoutPosts.workoutDate, weekRange.weekEndDate),
      ),
    );
  const validWorkoutCount = season.dailyDuplicatePolicy === "count_all"
    ? rows.length
    : new Set(rows.map((row) => row.workoutDate)).size;
  const missedCount = Math.max(season.targetWorkoutCountPerWeek - validWorkoutCount, 0);

  return {
    weekStartDate: weekRange.weekStartDate,
    weekEndDate: weekRange.weekEndDate,
    targetWorkoutCount: season.targetWorkoutCountPerWeek,
    validWorkoutCount,
    missedCount,
    finePerMiss: season.finePerMiss,
    estimatedFineAmount: missedCount * season.finePerMiss,
  };
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
    return {
      groupId,
      bankName: "미등록",
      accountNumber: "미등록",
      holderName: "미등록",
    };
  }

  return {
    groupId: rows[0].groupId.toString(),
    bankName: rows[0].bankName,
    accountNumber: rows[0].accountNumber,
    holderName: rows[0].holderName,
  };
}
function getCurrentKoreanWorkoutDate(dayStartTime: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const date = new Date(Date.UTC(Number(partMap.year), Number(partMap.month) - 1, Number(partMap.day)));
  const secondOfDay = Number(partMap.hour) * 3600 + Number(partMap.minute) * 60 + Number(partMap.second);

  if (secondOfDay < parseTimeToSecondOfDay(dayStartTime)) {
    date.setUTCDate(date.getUTCDate() - 1);
  }

  return date;
}

function getKoreanWeekRange(date = new Date(), weekStartDay = 0) {
  const baseDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayIndexFromMonday = (baseDate.getUTCDay() + 6) % 7;
  let startOffset = weekStartDay - dayIndexFromMonday;

  if (startOffset > 0) {
    startOffset -= 7;
  }

  baseDate.setUTCDate(baseDate.getUTCDate() + startOffset);

  const endDate = new Date(baseDate);
  endDate.setUTCDate(baseDate.getUTCDate() + 6);

  return {
    weekStartDate: baseDate.toISOString().slice(0, 10),
    weekEndDate: endDate.toISOString().slice(0, 10),
  };
}

function parseTimeToSecondOfDay(value: string) {
  const [hour = "0", minute = "0", second = "0"] = value.split(":");
  return Number(hour) * 3600 + Number(minute) * 60 + Number(second);
}
