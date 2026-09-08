import "server-only";

import { and, desc, eq, gt, inArray, isNull, ne, or, sql } from "drizzle-orm";

import { clearCurrentGroupId, getCurrentGroupIdForUser, requireCurrentUserId, setCurrentGroupIdForUser } from "@/auth/session";
import { generateInviteToken, isInviteTokenFormat } from "@/invites/tokens";
import { deleteLocalMediaFiles, saveUserAvatarSvg, saveWorkoutPostMediaFiles } from "@/storage/local";

import { db } from "./client";
import { ActiveSeasonNotFoundError, CurrentUserMembershipNotFoundError, GroupLeaveDelegateNotFoundError, GroupLeaveRequiresDelegationError, PendingSeasonAlreadyExistsError, PendingSeasonNotFoundError, SeasonStartDateInPastError } from "./errors";
import { groupInvites, groupJoinRequests, groupMembers, groups, postComments, postLikes, postMedia, seasons, seasonParticipantPeriods, users, weeklySettlementRows, weeklySettlements, workoutPosts } from "./schema";

const GROUP_INVITE_EXPIRES_HOURS = 72;

export async function createGroup(name: string) {
  const userId = await requireCurrentUserId();
  const groupName = name.trim();

  if (!groupName) {
    throw new Error("Group name is required.");
  }

  const joinedAt = getKoreanDate();
  const group = await db.transaction(async (tx) => {
    const userRows = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, BigInt(userId)), eq(users.status, "active"), isNull(users.deletedAt)))
      .limit(1);

    if (!userRows[0]) {
      throw new Error("Current user not found.");
    }

    const groupRows = await tx
      .insert(groups)
      .values({ name: groupName, ownerUserId: userRows[0].id })
      .returning({ id: groups.id });

    const groupId = groupRows[0].id;

    await tx.insert(groupMembers).values({
      groupId,
      userId: userRows[0].id,
      roles: ["admin"],
      joinedAt,
    });

    return { id: groupId.toString() };
  });

  await setCurrentGroupIdForUser(userId, group.id);
  return group;
}

type CreateSeasonInput = {
  name: string;
  startDate: string;
  targetWorkoutCountPerWeek: number;
  finePerMiss: number;
};
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

type LeaveGroupInput = {
  groupId: string;
  delegateUserId?: string;
};

export async function leaveGroup(input: LeaveGroupInput) {
  const userId = await requireCurrentUserId();
  if (!/^\d+$/.test(input.groupId)) {
    throw new Error("Invalid group id.");
  }

  const selectedGroupId = await getCurrentGroupIdForUser(userId);
  const now = new Date();
  const leftAt = getKoreanDate(now);

  const result = await db.transaction(async (tx) => {
    const membershipRows = await tx
      .select({ group: groups, member: groupMembers })
      .from(groupMembers)
      .innerJoin(groups, eq(groupMembers.groupId, groups.id))
      .where(and(eq(groupMembers.userId, BigInt(userId)), isNull(groupMembers.leftAt), isNull(groups.deletedAt)))
      .orderBy(desc(groupMembers.updatedAt), desc(groups.id));
    const membership = membershipRows.find((row) => row.group.id.toString() === input.groupId);

    if (!membership) {
      throw new CurrentUserMembershipNotFoundError();
    }

    const groupId = membership.group.id;
    const selectedActiveGroupId = selectedGroupId && membershipRows.some((row) => row.group.id.toString() === selectedGroupId)
      ? selectedGroupId
      : membershipRows[0]?.group.id.toString();
    const isAdmin = membership.member.roles.includes("admin");

    if (isAdmin) {
      const delegateUserId = input.delegateUserId?.trim();
      if (!delegateUserId || !/^\d+$/.test(delegateUserId) || delegateUserId === userId) {
        throw new GroupLeaveRequiresDelegationError();
      }

      const delegateRows = await tx
        .select({ roles: groupMembers.roles })
        .from(groupMembers)
        .innerJoin(users, eq(groupMembers.userId, users.id))
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.userId, BigInt(delegateUserId)),
            isNull(groupMembers.leftAt),
            eq(users.status, "active"),
            isNull(users.deletedAt),
          ),
        )
        .limit(1);
      const delegate = delegateRows[0];

      if (!delegate) {
        throw new GroupLeaveDelegateNotFoundError();
      }

      const delegatedRoles = delegate.roles.includes("admin") ? delegate.roles : [...delegate.roles, "admin" as const];
      await tx
        .update(groupMembers)
        .set({ roles: delegatedRoles, updatedAt: now })
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, BigInt(delegateUserId))));

      await tx.update(groups).set({ ownerUserId: BigInt(delegateUserId), updatedAt: now }).where(eq(groups.id, groupId));
    }

    await tx
      .update(groupMembers)
      .set({ leftAt, updatedAt: now })
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, BigInt(userId)), isNull(groupMembers.leftAt)));

    const activeSeasonRows = await tx.select({ id: seasons.id }).from(seasons).where(and(eq(seasons.groupId, groupId), eq(seasons.status, "active"))).limit(1);
    const activeSeason = activeSeasonRows[0];
    if (activeSeason) {
      await tx
        .update(seasonParticipantPeriods)
        .set({ endDate: leftAt })
        .where(and(eq(seasonParticipantPeriods.seasonId, activeSeason.id), eq(seasonParticipantPeriods.userId, BigInt(userId)), isNull(seasonParticipantPeriods.endDate)));
    }

    const nextMembershipRows = await tx
      .select({ groupId: groupMembers.groupId })
      .from(groupMembers)
      .innerJoin(groups, eq(groupMembers.groupId, groups.id))
      .where(and(eq(groupMembers.userId, BigInt(userId)), ne(groupMembers.groupId, groupId), isNull(groupMembers.leftAt), isNull(groups.deletedAt)))
      .orderBy(desc(groupMembers.updatedAt), desc(groups.id))
      .limit(1);

    const leftGroupId = groupId.toString();
    const nextGroupId = leftGroupId === selectedActiveGroupId ? nextMembershipRows[0]?.groupId.toString() : selectedActiveGroupId;

    return { leftGroupId, nextGroupId };
  });

  if (result.nextGroupId) {
    await setCurrentGroupIdForUser(userId, result.nextGroupId);
  } else {
    await clearCurrentGroupId();
  }

  return result;
}

type DeleteGroupInput = {
  groupId: string;
};

export async function deleteGroup(input: DeleteGroupInput) {
  const userId = await requireCurrentUserId();
  if (!/^\d+$/.test(input.groupId)) {
    throw new Error("Invalid group id.");
  }

  const selectedGroupId = await getCurrentGroupIdForUser(userId);
  const now = new Date();
  const leftAt = getKoreanDate(now);

  const result = await db.transaction(async (tx) => {
    const membershipRows = await tx
      .select({ group: groups, member: groupMembers })
      .from(groupMembers)
      .innerJoin(groups, eq(groupMembers.groupId, groups.id))
      .where(and(eq(groupMembers.userId, BigInt(userId)), isNull(groupMembers.leftAt), isNull(groups.deletedAt)))
      .orderBy(desc(groupMembers.updatedAt), desc(groups.id));
    const membership = membershipRows.find((row) => row.group.id.toString() === input.groupId);

    if (!membership) {
      throw new CurrentUserMembershipNotFoundError();
    }

    if (!membership.member.roles.includes("admin")) {
      throw new Error("Only admins can delete groups.");
    }

    const groupId = membership.group.id;
    const selectedActiveGroupId = selectedGroupId && membershipRows.some((row) => row.group.id.toString() === selectedGroupId)
      ? selectedGroupId
      : membershipRows[0]?.group.id.toString();

    await tx.update(groups).set({ deletedAt: now, updatedAt: now }).where(and(eq(groups.id, groupId), isNull(groups.deletedAt)));
    await tx.update(groupMembers).set({ leftAt, updatedAt: now }).where(and(eq(groupMembers.groupId, groupId), isNull(groupMembers.leftAt)));
    await tx
      .update(seasonParticipantPeriods)
      .set({ endDate: leftAt })
      .where(
        and(
          inArray(
            seasonParticipantPeriods.seasonId,
            tx.select({ id: seasons.id }).from(seasons).where(eq(seasons.groupId, groupId)),
          ),
          isNull(seasonParticipantPeriods.endDate),
        ),
      );
    await tx.update(groupInvites).set({ status: "expired", expiresAt: now }).where(and(eq(groupInvites.groupId, groupId), eq(groupInvites.status, "active")));
    await tx
      .update(groupJoinRequests)
      .set({ status: "rejected", reviewedByUserId: BigInt(userId), reviewedAt: now })
      .where(and(eq(groupJoinRequests.groupId, groupId), eq(groupJoinRequests.status, "pending")));

    const nextMembershipRows = await tx
      .select({ groupId: groupMembers.groupId })
      .from(groupMembers)
      .innerJoin(groups, eq(groupMembers.groupId, groups.id))
      .where(and(eq(groupMembers.userId, BigInt(userId)), ne(groupMembers.groupId, groupId), isNull(groupMembers.leftAt), isNull(groups.deletedAt)))
      .orderBy(desc(groupMembers.updatedAt), desc(groups.id))
      .limit(1);

    const deletedGroupId = groupId.toString();
    const nextGroupId = deletedGroupId === selectedActiveGroupId ? nextMembershipRows[0]?.groupId.toString() : selectedActiveGroupId;

    return { deletedGroupId, nextGroupId };
  });

  if (result.nextGroupId) {
    await setCurrentGroupIdForUser(userId, result.nextGroupId);
  } else {
    await clearCurrentGroupId();
  }

  return result;
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

export async function getOrCreateCurrentGroupInvite() {
  const context = await getCurrentGroupAdminContext();
  const now = new Date();

  const reusableRows = await db
    .select({
      id: groupInvites.id,
      inviteToken: groupInvites.inviteToken,
      expiresAt: groupInvites.expiresAt,
      maxUses: groupInvites.maxUses,
      usedCount: groupInvites.usedCount,
      status: groupInvites.status,
    })
    .from(groupInvites)
    .where(
      and(
        eq(groupInvites.groupId, BigInt(context.groupId)),
        eq(groupInvites.status, "active"),
        gt(groupInvites.expiresAt, now),
        or(isNull(groupInvites.maxUses), sql`${groupInvites.usedCount} < ${groupInvites.maxUses}`),
      ),
    )
    .orderBy(desc(groupInvites.createdAt), desc(groupInvites.id))
    .limit(1);

  if (reusableRows[0]) {
    return toGroupInviteResult(reusableRows[0]);
  }

  return createCurrentGroupInvite(context);
}

export async function regenerateCurrentGroupInvite() {
  const context = await getCurrentGroupAdminContext();
  const now = new Date();

  return db.transaction(async (tx) => {
    await tx
      .update(groupInvites)
      .set({ status: "expired", expiresAt: now })
      .where(and(eq(groupInvites.groupId, BigInt(context.groupId)), eq(groupInvites.status, "active")));

    return createCurrentGroupInvite(context, tx, now);
  });
}

type CurrentGroupInviteContext = {
  groupId: string;
  userId: string;
};

type GroupInviteExecutor = Pick<typeof db, "insert">;

async function createCurrentGroupInvite(context: CurrentGroupInviteContext, executor: GroupInviteExecutor = db, now = new Date()) {
  const expiresAt = new Date(now);
  expiresAt.setHours(expiresAt.getHours() + GROUP_INVITE_EXPIRES_HOURS);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const rows = await executor
      .insert(groupInvites)
      .values({
        groupId: BigInt(context.groupId),
        inviteToken: generateInviteToken(),
        createdByUserId: BigInt(context.userId),
        expiresAt,
      })
      .onConflictDoNothing({ target: groupInvites.inviteToken })
      .returning({
        id: groupInvites.id,
        inviteToken: groupInvites.inviteToken,
        expiresAt: groupInvites.expiresAt,
        maxUses: groupInvites.maxUses,
        usedCount: groupInvites.usedCount,
        status: groupInvites.status,
      });

    if (rows[0]) {
      return toGroupInviteResult(rows[0]);
    }
  }

  throw new Error("Failed to create invite token.");
}

function toGroupInviteResult(row: {
  id: bigint;
  inviteToken: string;
  expiresAt: Date | null;
  maxUses: number | null;
  usedCount: number;
  status: "active" | "disabled" | "expired";
}) {
  return {
    id: row.id.toString(),
    inviteToken: row.inviteToken,
    invitePath: `/join/${row.inviteToken}`,
    expiresAt: row.expiresAt?.toISOString(),
    maxUses: row.maxUses ?? undefined,
    usedCount: row.usedCount,
    status: row.status,
  };
}

export async function requestCurrentUserGroupJoin(inviteToken: string) {
  const token = inviteToken.trim();
  if (!isInviteTokenFormat(token)) {
    return { status: "invalid" as const };
  }

  const userId = await requireCurrentUserId();
  const now = new Date();

  const result = await db.transaction(async (tx) => {
    const inviteRows = await tx
      .select({
        id: groupInvites.id,
        groupId: groupInvites.groupId,
        maxUses: groupInvites.maxUses,
        usedCount: groupInvites.usedCount,
      })
      .from(groupInvites)
      .innerJoin(groups, eq(groupInvites.groupId, groups.id))
      .where(
        and(
          eq(groupInvites.inviteToken, token),
          eq(groupInvites.status, "active"),
          isNull(groups.deletedAt),
          gt(groupInvites.expiresAt, now),
          or(isNull(groupInvites.maxUses), sql`${groupInvites.usedCount} < ${groupInvites.maxUses}`),
        ),
      )
      .limit(1);

    const invite = inviteRows[0];
    if (!invite) {
      return { status: "invalid" as const };
    }

    const memberRows = await tx
      .select({ groupId: groupMembers.groupId })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, invite.groupId), eq(groupMembers.userId, BigInt(userId)), isNull(groupMembers.leftAt)))
      .limit(1);

    if (memberRows[0]) {
      return { status: "already_member" as const, groupId: invite.groupId.toString() };
    }

    const requestRows = await tx
      .select({ id: groupJoinRequests.id, status: groupJoinRequests.status })
      .from(groupJoinRequests)
      .where(and(eq(groupJoinRequests.groupId, invite.groupId), eq(groupJoinRequests.userId, BigInt(userId))))
      .limit(1);

    const existingRequest = requestRows[0];
    if (existingRequest?.status === "pending") {
      return { status: "pending" as const, groupId: invite.groupId.toString() };
    }

    if (existingRequest) {
      await tx
        .update(groupJoinRequests)
        .set({
          inviteId: invite.id,
          status: "pending",
          requestedAt: now,
          reviewedByUserId: null,
          reviewedAt: null,
        })
        .where(eq(groupJoinRequests.id, existingRequest.id));
    } else {
      await tx.insert(groupJoinRequests).values({
        groupId: invite.groupId,
        inviteId: invite.id,
        userId: BigInt(userId),
        status: "pending",
        requestedAt: now,
      });
    }

    await tx
      .update(groupInvites)
      .set({ usedCount: sql`${groupInvites.usedCount} + 1` })
      .where(eq(groupInvites.id, invite.id));

    return { status: "requested" as const, groupId: invite.groupId.toString() };
  });

  if (result.status === "already_member") {
    await setCurrentGroupIdForUser(userId, result.groupId);
  }

  return result;
}

export async function reviewGroupJoinRequest(requestId: string, decision: "approve" | "reject") {
  const context = await getCurrentGroupAdminContext();

  if (!/^\d+$/.test(requestId)) {
    throw new Error("Invalid join request id.");
  }

  const now = new Date();
  const joinedAt = getKoreanDate(now);

  return db.transaction(async (tx) => {
    const requestRows = await tx
      .select({ request: groupJoinRequests, userId: users.id })
      .from(groupJoinRequests)
      .innerJoin(users, eq(groupJoinRequests.userId, users.id))
      .where(
        and(
          eq(groupJoinRequests.id, BigInt(requestId)),
          eq(groupJoinRequests.groupId, BigInt(context.groupId)),
          eq(groupJoinRequests.status, "pending"),
          eq(users.status, "active"),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);

    const target = requestRows[0];
    if (!target) {
      throw new Error("Pending join request not found.");
    }

    if (decision === "reject") {
      const rows = await tx
        .update(groupJoinRequests)
        .set({
          status: "rejected",
          reviewedByUserId: BigInt(context.userId),
          reviewedAt: now,
        })
        .where(eq(groupJoinRequests.id, target.request.id))
        .returning({ id: groupJoinRequests.id });

      return { id: rows[0].id.toString(), status: "rejected" as const };
    }

    const existingMemberRows = await tx
      .select({ groupId: groupMembers.groupId, userId: groupMembers.userId })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, target.request.groupId), eq(groupMembers.userId, target.userId)))
      .limit(1);

    if (existingMemberRows[0]) {
      await tx
        .update(groupMembers)
        .set({ roles: ["member"], joinedAt, leftAt: null, updatedAt: now })
        .where(and(eq(groupMembers.groupId, target.request.groupId), eq(groupMembers.userId, target.userId)));
    } else {
      await tx.insert(groupMembers).values({
        groupId: target.request.groupId,
        userId: target.userId,
        roles: ["member"],
        joinedAt,
      });
    }

    const activeSeasonRows = await tx
      .select({ id: seasons.id })
      .from(seasons)
      .where(and(eq(seasons.groupId, target.request.groupId), eq(seasons.status, "active")))
      .limit(1);

    const activeSeason = activeSeasonRows[0];
    if (activeSeason) {
      const activePeriodRows = await tx
        .select({ id: seasonParticipantPeriods.id })
        .from(seasonParticipantPeriods)
        .where(
          and(
            eq(seasonParticipantPeriods.seasonId, activeSeason.id),
            eq(seasonParticipantPeriods.userId, target.userId),
            isNull(seasonParticipantPeriods.endDate),
          ),
        )
        .limit(1);

      if (!activePeriodRows[0]) {
        await tx.insert(seasonParticipantPeriods).values({
          seasonId: activeSeason.id,
          userId: target.userId,
          startDate: joinedAt,
        });
      }
    }

    const rows = await tx
      .update(groupJoinRequests)
      .set({
        status: "approved",
        reviewedByUserId: BigInt(context.userId),
        reviewedAt: now,
      })
      .where(eq(groupJoinRequests.id, target.request.id))
      .returning({ id: groupJoinRequests.id });

    return { id: rows[0].id.toString(), status: "approved" as const };
  });
}

export async function createSeason(input: CreateSeasonInput) {
  const context = await getCurrentGroupAdminContext();
  const seasonName = input.name.trim();
  const today = getKoreanDate();

  if (!seasonName) {
    throw new Error("Season name is required.");
  }

  if (input.startDate < today) {
    throw new SeasonStartDateInPastError();
  }

  return db.transaction(async (tx) => {
    const [activeSeasonRows, pendingSeasonRows] = await Promise.all([
      tx
        .select({ id: seasons.id })
        .from(seasons)
        .where(and(eq(seasons.groupId, BigInt(context.groupId)), eq(seasons.status, "active")))
        .limit(1),
      tx
        .select({ id: seasons.id })
        .from(seasons)
        .where(and(eq(seasons.groupId, BigInt(context.groupId)), eq(seasons.status, "pending")))
        .limit(1),
    ]);

    if (pendingSeasonRows[0]) {
      throw new PendingSeasonAlreadyExistsError();
    }

    const shouldActivateNow = input.startDate === today && !activeSeasonRows[0];
    const seasonRows = await tx
      .insert(seasons)
      .values({
        groupId: BigInt(context.groupId),
        name: seasonName,
        startDate: input.startDate,
        targetWorkoutCountPerWeek: input.targetWorkoutCountPerWeek,
        finePerMiss: input.finePerMiss,
        status: shouldActivateNow ? "active" : "pending",
      })
      .returning({ id: seasons.id });

    const seasonId = seasonRows[0].id;

    if (shouldActivateNow) {
      await initializeActiveSeason(tx, seasonId, BigInt(context.groupId), today);
    }

    return { id: seasonId.toString(), status: shouldActivateNow ? "active" as const : "pending" as const };
  });
}

export async function activateCurrentGroupPendingSeason() {
  const context = await getCurrentGroupAdminContext();
  const today = getKoreanDate();

  return db.transaction(async (tx) => {
    const pendingSeasonRows = await tx
      .select({ id: seasons.id, startDate: seasons.startDate })
      .from(seasons)
      .where(and(eq(seasons.groupId, BigInt(context.groupId)), eq(seasons.status, "pending")))
      .orderBy(seasons.startDate, seasons.id)
      .limit(1);
    const pendingSeason = pendingSeasonRows[0];

    if (!pendingSeason) {
      throw new PendingSeasonNotFoundError();
    }


    const activatedSeason = await activatePendingSeasonForGroup(tx, BigInt(context.groupId), today);
    if (!activatedSeason) {
      throw new ActiveSeasonNotFoundError();
    }

    return { id: activatedSeason.id.toString() };
  });
}

export async function deletePendingSeason(seasonId: string) {
  const context = await getCurrentGroupAdminContext();
  const rows = await db
    .delete(seasons)
    .where(and(eq(seasons.id, BigInt(seasonId)), eq(seasons.groupId, BigInt(context.groupId)), eq(seasons.status, "pending")))
    .returning({ id: seasons.id });

  if (!rows[0]) {
    throw new Error("Pending season not found.");
  }

  return { id: rows[0].id.toString() };
}

type CloseSeasonInput = {
  seasonId: string;
  activatePendingSeason: boolean;
};

export async function closeActiveSeason(input: CloseSeasonInput) {
  const context = await getCurrentGroupAdminContext();
  const today = getKoreanDate();

  return db.transaction(async (tx) => {
    const closedSeasonRows = await tx
      .update(seasons)
      .set({ status: "closed", endDate: today, updatedAt: new Date() })
      .where(and(eq(seasons.id, BigInt(input.seasonId)), eq(seasons.groupId, BigInt(context.groupId)), eq(seasons.status, "active")))
      .returning({ id: seasons.id });

    if (!closedSeasonRows[0]) {
      throw new ActiveSeasonNotFoundError();
    }

    await tx
      .update(seasonParticipantPeriods)
      .set({ endDate: today })
      .where(and(eq(seasonParticipantPeriods.seasonId, closedSeasonRows[0].id), isNull(seasonParticipantPeriods.endDate)));

    if (!input.activatePendingSeason) {
      return { closedSeasonId: closedSeasonRows[0].id.toString(), activatedSeasonId: undefined };
    }

    const activatedSeason = await activatePendingSeasonForGroup(tx, BigInt(context.groupId), today);

    return {
      closedSeasonId: closedSeasonRows[0].id.toString(),
      activatedSeasonId: activatedSeason?.id.toString(),
    };
  });
}

export async function activateDuePendingSeasons(now = new Date()) {
  const today = getKoreanDate(now);
  return db.transaction(async (tx) => {
    const pendingRows = await tx
      .select({ groupId: seasons.groupId })
      .from(seasons)
      .where(and(eq(seasons.status, "pending"), sql`${seasons.startDate} <= ${today}`))
      .orderBy(seasons.startDate, seasons.id);

    const activatedSeasonIds: string[] = [];
    const seenGroupIds = new Set<string>();

    for (const pending of pendingRows) {
      const groupId = pending.groupId.toString();
      if (seenGroupIds.has(groupId)) {
        continue;
      }

      seenGroupIds.add(groupId);
      const activatedSeason = await activateDuePendingSeasonForGroup(tx, pending.groupId, today);
      if (activatedSeason) {
        activatedSeasonIds.push(activatedSeason.id.toString());
      }
    }

    return { activatedSeasonIds };
  });
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


export async function deletePostComment(commentId: string) {
  const context = await getCurrentSeedContext();
  if (!/^\d+$/.test(commentId)) {
    throw new Error("Invalid comment id.");
  }

  const targetRows = await db
    .select({ id: postComments.id })
    .from(postComments)
    .innerJoin(workoutPosts, eq(postComments.postId, workoutPosts.id))
    .where(
      and(
        eq(postComments.id, BigInt(commentId)),
        eq(postComments.userId, BigInt(context.userId)),
        isNull(postComments.deletedAt),
        eq(workoutPosts.groupId, BigInt(context.groupId)),
        eq(workoutPosts.seasonId, BigInt(context.seasonId)),
        isNull(workoutPosts.deletedAt),
      ),
    )
    .limit(1);

  if (!targetRows[0]) {
    throw new Error("Comment not found or not allowed to delete.");
  }

  const rows = await db
    .update(postComments)
    .set({ deletedAt: new Date() })
    .where(eq(postComments.id, targetRows[0].id))
    .returning({ id: postComments.id });

  return { id: rows[0].id.toString() };
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
async function getCurrentGroupAdminContext() {
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

  if (!membership.roles.includes("admin")) {
    throw new Error("Only admins can create group invites.");
  }

  return {
    userId: membership.userId.toString(),
    groupId: membership.groupId.toString(),
    roles: membership.roles,
  };
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
    throw new ActiveSeasonNotFoundError();
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
async function activatePendingSeasonForGroup(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], groupId: bigint, activationDate: string) {
  const activeSeasonRows = await tx
    .select({ id: seasons.id })
    .from(seasons)
    .where(and(eq(seasons.groupId, groupId), eq(seasons.status, "active")))
    .limit(1);

  if (activeSeasonRows[0]) {
    return undefined;
  }

  const pendingSeasonRows = await tx
    .select({ id: seasons.id })
    .from(seasons)
    .where(and(eq(seasons.groupId, groupId), eq(seasons.status, "pending")))
    .orderBy(seasons.startDate, seasons.id)
    .limit(1);
  const pendingSeason = pendingSeasonRows[0];

  if (!pendingSeason) {
    return undefined;
  }

  const activatedSeasonRows = await tx
    .update(seasons)
    .set({ status: "active", startDate: activationDate, updatedAt: new Date() })
    .where(and(eq(seasons.id, pendingSeason.id), eq(seasons.groupId, groupId), eq(seasons.status, "pending")))
    .returning({ id: seasons.id });
  const activatedSeason = activatedSeasonRows[0];

  if (!activatedSeason) {
    return undefined;
  }

  await initializeActiveSeason(tx, activatedSeason.id, groupId, activationDate);
  return activatedSeason;
}

async function activateDuePendingSeasonForGroup(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], groupId: bigint, activationDate: string) {
  const activeSeasonRows = await tx
    .select({ id: seasons.id })
    .from(seasons)
    .where(and(eq(seasons.groupId, groupId), eq(seasons.status, "active")))
    .limit(1);

  if (activeSeasonRows[0]) {
    return undefined;
  }

  const pendingSeasonRows = await tx
    .select({ id: seasons.id })
    .from(seasons)
    .where(and(eq(seasons.groupId, groupId), eq(seasons.status, "pending"), sql`${seasons.startDate} <= ${activationDate}`))
    .orderBy(seasons.startDate, seasons.id)
    .limit(1);
  const pendingSeason = pendingSeasonRows[0];

  if (!pendingSeason) {
    return undefined;
  }

  const activatedSeasonRows = await tx
    .update(seasons)
    .set({ status: "active", startDate: activationDate, updatedAt: new Date() })
    .where(and(eq(seasons.id, pendingSeason.id), eq(seasons.groupId, groupId), eq(seasons.status, "pending")))
    .returning({ id: seasons.id });
  const activatedSeason = activatedSeasonRows[0];

  if (!activatedSeason) {
    return undefined;
  }

  await initializeActiveSeason(tx, activatedSeason.id, groupId, activationDate);
  return activatedSeason;
}

async function initializeActiveSeason(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], seasonId: bigint, groupId: bigint, activationDate: string) {
  const memberRows = await tx
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), isNull(groupMembers.leftAt)));

  if (memberRows.length > 0) {
    await tx.insert(seasonParticipantPeriods).values(
      memberRows.map((member) => ({
        seasonId,
        userId: member.userId,
        startDate: activationDate,
      })),
    );
  }

  const weekRange = getKoreanWeekRange(new Date(`${activationDate}T00:00:00+09:00`));
  const settlementRows = await tx
    .insert(weeklySettlements)
    .values({
      groupId,
      seasonId,
      weekStartDate: weekRange.weekStartDate,
      weekEndDate: weekRange.weekEndDate,
      status: "draft",
    })
    .onConflictDoNothing()
    .returning({ id: weeklySettlements.id });

  const settlementId = settlementRows[0]?.id;
  if (settlementId && memberRows.length > 0) {
    await tx.insert(weeklySettlementRows).values(
      memberRows.map((member) => ({
        settlementId,
        userId: member.userId,
        validWorkoutCount: 0,
        missedCount: 0,
        autoFineAmount: 0,
        finalFineAmount: 0,
      })),
    );
  }
}
function getKoreanDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
function getKoreanWeekRange(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const baseDate = new Date(Date.UTC(Number(partMap.year), Number(partMap.month) - 1, Number(partMap.day)));
  const day = baseDate.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  baseDate.setUTCDate(baseDate.getUTCDate() + mondayOffset);

  const endDate = new Date(baseDate);
  endDate.setUTCDate(baseDate.getUTCDate() + 6);

  return {
    weekStartDate: baseDate.toISOString().slice(0, 10),
    weekEndDate: endDate.toISOString().slice(0, 10),
  };
}
