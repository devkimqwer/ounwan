import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";

import { getCurrentGroupIdForUser, requireCurrentUserId, setCurrentGroupIdForUser } from "@/auth/session";
import { deleteLocalMediaFiles, saveUserAvatarSvg, saveWorkoutPostMediaFiles } from "@/storage/local";

import { db } from "./client";
import { CurrentUserMembershipNotFoundError } from "./errors";
import { groupMembers, groups, postComments, postLikes, postMedia, seasons, users, workoutPosts } from "./schema";

type CreateWorkoutPostInput = {
  workoutType?: string;
  content?: string;
  mediaFiles: File[];
};


export async function updateCurrentUserProfile(displayName: string) {
  const userId = await requireCurrentUserId();
  const rows = await db
    .update(users)
    .set({ displayName, updatedAt: new Date() })
    .where(and(eq(users.id, BigInt(userId)), eq(users.status, "active"), isNull(users.deletedAt)))
    .returning({ id: users.id });

  if (!rows[0]) {
    throw new Error("Current user not found.");
  }

  return { id: rows[0].id.toString() };
}

export async function refreshCurrentUserAvatar() {
  const userId = await requireCurrentUserId();
  const avatarStorageKey = await saveUserAvatarSvg(userId);
  const rows = await db
    .update(users)
    .set({ avatarStorageKey, updatedAt: new Date() })
    .where(and(eq(users.id, BigInt(userId)), eq(users.status, "active"), isNull(users.deletedAt)))
    .returning({ id: users.id });

  if (!rows[0]) {
    throw new Error("Current user not found.");
  }

  return { id: rows[0].id.toString() };
}

export async function switchCurrentGroup(groupId: string) {
  const userId = await requireCurrentUserId();
  if (!/^\d+$/.test(groupId)) {
    throw new Error("Invalid group id.");
  }

  const rows = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(
      and(
        eq(groupMembers.userId, BigInt(userId)),
        eq(groupMembers.groupId, BigInt(groupId)),
        isNull(groupMembers.leftAt),
        isNull(groups.deletedAt),
      ),
    )
    .limit(1);

  if (!rows[0]) {
    throw new Error("Group membership not found.");
  }

  await setCurrentGroupIdForUser(userId, rows[0].groupId.toString());
  return { groupId: rows[0].groupId.toString() };
}

export async function createWorkoutPost(input: CreateWorkoutPostInput) {
  const context = await getCurrentSeedContext();
  const postRows = await db
    .insert(workoutPosts)
    .values({
      groupId: BigInt(context.groupId),
      seasonId: BigInt(context.seasonId),
      userId: BigInt(context.userId),
      workoutDate: getKoreanWorkoutDate(),
      workoutType: input.workoutType ?? null,
      content: input.content,
    })
    .returning({ id: workoutPosts.id });
  const postId = postRows[0].id;

  let storedMediaFiles: Awaited<ReturnType<typeof saveWorkoutPostMediaFiles>> = [];

  try {
    storedMediaFiles = await saveWorkoutPostMediaFiles({
      files: input.mediaFiles,
      groupId: context.groupId,
      seasonId: context.seasonId,
      postId: postId.toString(),
    });

    await db.insert(postMedia).values(
      storedMediaFiles.map((file, index) => ({
        postId,
        mediaType: file.mediaType,
        storageProvider: "local" as const,
        storageKey: file.storageKey,
        fileSizeBytes: file.fileSizeBytes,
        contentType: file.contentType,
        thumbnailUrl: file.thumbnailStorageKey ? `/uploads/${file.thumbnailStorageKey}` : null,
        sortOrder: index + 1,
      })),
    );
  } catch (error) {
    await deleteLocalMediaFiles(storedMediaFiles.flatMap((file) => [file.storageKey, file.thumbnailStorageKey]));
    await db.delete(workoutPosts).where(eq(workoutPosts.id, postId));
    throw error;
  }

  return { id: postId.toString() };
}



export async function togglePostLike(postId: string) {
  const context = await getCurrentSeedContext();
  const targetPostRows = await db
    .select({ id: workoutPosts.id })
    .from(workoutPosts)
    .where(
      and(
        eq(workoutPosts.id, BigInt(postId)),
        eq(workoutPosts.groupId, BigInt(context.groupId)),
        eq(workoutPosts.seasonId, BigInt(context.seasonId)),
        isNull(workoutPosts.deletedAt),
      ),
    )
    .limit(1);

  if (!targetPostRows[0]) {
    throw new Error("Workout post not found or not allowed to like.");
  }

  const deletedRows = await db
    .delete(postLikes)
    .where(and(eq(postLikes.postId, targetPostRows[0].id), eq(postLikes.userId, BigInt(context.userId))))
    .returning({ postId: postLikes.postId });

  if (deletedRows[0]) {
    return { liked: false };
  }

  await db.insert(postLikes).values({ postId: targetPostRows[0].id, userId: BigInt(context.userId) });
  return { liked: true };
}

export async function createPostComment(postId: string, content: string) {
  const context = await getCurrentSeedContext();
  const targetPostRows = await db
    .select({ id: workoutPosts.id })
    .from(workoutPosts)
    .where(
      and(
        eq(workoutPosts.id, BigInt(postId)),
        eq(workoutPosts.groupId, BigInt(context.groupId)),
        eq(workoutPosts.seasonId, BigInt(context.seasonId)),
        isNull(workoutPosts.deletedAt),
      ),
    )
    .limit(1);

  if (!targetPostRows[0]) {
    throw new Error("Workout post not found or not allowed to comment.");
  }

  const commentRows = await db
    .insert(postComments)
    .values({
      postId: targetPostRows[0].id,
      userId: BigInt(context.userId),
      content,
    })
    .returning({ id: postComments.id });

  return { id: commentRows[0].id.toString() };
}

export async function toggleWorkoutPostInvalid(postId: string) {
  const context = await getCurrentSeedContext();

  if (!context.roles.includes("admin")) {
    throw new Error("Only admins can invalidate workout posts.");
  }

  const targetPostRows = await db
    .select({ id: workoutPosts.id, isInvalid: workoutPosts.isInvalid })
    .from(workoutPosts)
    .where(
      and(
        eq(workoutPosts.id, BigInt(postId)),
        eq(workoutPosts.groupId, BigInt(context.groupId)),
        eq(workoutPosts.seasonId, BigInt(context.seasonId)),
        isNull(workoutPosts.deletedAt),
      ),
    )
    .limit(1);

  if (!targetPostRows[0]) {
    throw new Error("Workout post not found or not allowed to invalidate.");
  }

  const nextIsInvalid = !targetPostRows[0].isInvalid;
  const postRows = await db
    .update(workoutPosts)
    .set({
      isInvalid: nextIsInvalid,
      invalidatedByUserId: nextIsInvalid ? BigInt(context.userId) : null,
      invalidatedAt: nextIsInvalid ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(workoutPosts.id, targetPostRows[0].id))
    .returning({ id: workoutPosts.id, isInvalid: workoutPosts.isInvalid });

  return { id: postRows[0].id.toString(), isInvalid: postRows[0].isInvalid };
}

export async function deleteWorkoutPost(postId: string) {
  const context = await getCurrentSeedContext();
  const postRows = await db
    .update(workoutPosts)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(workoutPosts.id, BigInt(postId)),
        eq(workoutPosts.groupId, BigInt(context.groupId)),
        eq(workoutPosts.seasonId, BigInt(context.seasonId)),
        eq(workoutPosts.userId, BigInt(context.userId)),
        isNull(workoutPosts.deletedAt),
      ),
    )
    .returning({ id: workoutPosts.id });

  if (!postRows[0]) {
    throw new Error("Workout post not found or not allowed to delete.");
  }

  return { id: postRows[0].id.toString() };
}
async function getCurrentSeedContext() {
  const userId = await requireCurrentUserId();
  const selectedGroupId = await getCurrentGroupIdForUser(userId);
  const membershipRows = await db
    .select({ groupId: groupMembers.groupId, userId: groupMembers.userId, roles: groupMembers.roles })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(and(eq(groupMembers.userId, BigInt(userId)), isNull(groupMembers.leftAt), isNull(groups.deletedAt)))
    .orderBy(desc(groupMembers.updatedAt), desc(groups.id));
  const membership = membershipRows.find((row) => row.groupId.toString() === selectedGroupId) ?? membershipRows[0];

  if (!membership) {
    throw new CurrentUserMembershipNotFoundError();
  }

  const seasonRows = await db
    .select({ id: seasons.id })
    .from(seasons)
    .where(and(eq(seasons.groupId, membership.groupId), eq(seasons.status, "active")))
    .limit(1);

  if (!seasonRows[0]) {
    throw new Error("Active season not found. Run npm run db:seed:local first.");
  }

  return {
    userId: membership.userId.toString(),
    groupId: membership.groupId.toString(),
    seasonId: seasonRows[0].id.toString(),
    roles: membership.roles,
  };
}

function getKoreanWorkoutDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(partMap.year);
  const month = Number(partMap.month);
  const day = Number(partMap.day);
  const hour = Number(partMap.hour);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (hour < 3) {
    date.setUTCDate(date.getUTCDate() - 1);
  }

  return date.toISOString().slice(0, 10);
}
