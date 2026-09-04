import "server-only";

import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";

import type {
  AccountInfo,
  BankRecord,
  Group,
  GroupMembership,
  PostMedia,
  PostComment,
  Season,
  Settlement,
  SettlementRow,
  User,
  UserGroupMembership,
  WorkoutPost,
} from "@/domain/models";
import { getCurrentGroupIdForUser, requireCurrentUserId } from "@/auth/session";
import type { OunwanAppData } from "@/domain/app-data";
import { db } from "./client";
import { CurrentUserMembershipNotFoundError } from "./errors";
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
  const [appUsers, posts, settlement, bankRecords, accountInfo] = await Promise.all([
    getGroupUsers(group.id),
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

  return {
    id: rows[0].id.toString(),
    kakaoId: rows[0].kakaoId ?? "",
    name: rows[0].displayName,
    avatarUrl: rows[0].avatarStorageKey ? `/uploads/${rows[0].avatarStorageKey}?v=${rows[0].updatedAt.getTime()}` : undefined,
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
