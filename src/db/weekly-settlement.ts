import { and, asc, eq, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";

import type { SettlementDailyResults } from "../domain/models";
import { calculateDailyWorkouts } from "../lib/workout-count";
import {
  getKoreanWorkoutDate,
  getKoreanWeekRange,
  getNextSettlementAt,
  getNextSettlementAtAfter,
  getPreviousSettlementPeriod,
  getSettlementWindow,
} from "../lib/season-time";
import { sendPushForNotifications } from "../push-service";
import { db } from "./database";
import { groups, notifications, seasonParticipantPeriods, seasons, weeklySettlementRows, weeklySettlements, workoutPosts } from "./schema";

const WEEKLY_SETTLEMENT_BATCH_LOCK_KEY = 90314001;

export type WeeklySettlementBatchResult = {
  status: "completed" | "skipped";
  dueCount: number;
  successCount: number;
  failureCount: number;
  initializedCount: number;
};

type SettlementSeason = {
  id: bigint;
  groupId: bigint;
  name: string;
  targetWorkoutCountPerWeek: number;
  finePerMiss: number;
  weekStartDay: number;
  dayStartTime: string;
  dailyDuplicatePolicy: "count_once" | "count_all";
};

type DueSeason = SettlementSeason & {
  nextSettlementAt: Date | null;
};

type SettlementPeriod = {
  weekStartDate: string;
  weekEndDate: string;
};

type SettlementWorkoutPost = {
  id: bigint;
  userId: bigint;
  createdAt: Date;
};

type CalculatedSettlementRow = {
  userId: bigint;
  validWorkoutCount: number;
  missedCount: number;
  autoFineAmount: number;
  finalFineAmount: number;
  dailyResults: SettlementDailyResults;
};

type BatchTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function runWeeklySettlementBatch(now = new Date()): Promise<WeeklySettlementBatchResult> {
  log("start", { now: now.toISOString() });
  const locked = await acquireBatchLock();

  if (!locked) {
    log("skipped", { reason: "batch lock is already held" });
    return { status: "skipped", dueCount: 0, successCount: 0, failureCount: 0, initializedCount: 0 };
  }

  try {
    const dueSeasons = await getDueSeasons(now);
    log("due seasons found", { dueCount: dueSeasons.length });

    let successCount = 0;
    let failureCount = 0;
    let initializedCount = 0;

    for (const season of dueSeasons) {
      log("season start", { seasonId: season.id.toString(), seasonName: season.name });

      try {
        const result = await processDueSeason(season, now);

        if (result.status === "initialized") {
          initializedCount += 1;
        } else {
          successCount += 1;
        }

        log("season success", { seasonId: season.id.toString(), ...result });
      } catch (error) {
        failureCount += 1;
        log("season failure", { seasonId: season.id.toString(), error: serializeError(error) });
      }
    }

    log("completed", { dueCount: dueSeasons.length, successCount, failureCount, initializedCount });
    return { status: "completed", dueCount: dueSeasons.length, successCount, failureCount, initializedCount };
  } finally {
    await releaseBatchLock();
  }
}

export async function syncDraftSettlementRowForWorkoutPost(postId: bigint) {
  await db.transaction(async (tx) => {
    const postRows = await tx
      .select({
        id: workoutPosts.id,
        userId: workoutPosts.userId,
        seasonId: workoutPosts.seasonId,
        createdAt: workoutPosts.createdAt,
      })
      .from(workoutPosts)
      .where(eq(workoutPosts.id, postId))
      .limit(1);
    const post = postRows[0];

    if (!post) {
      return;
    }

    const seasonRows = await tx
      .select({
        id: seasons.id,
        groupId: seasons.groupId,
        name: seasons.name,
        targetWorkoutCountPerWeek: seasons.targetWorkoutCountPerWeek,
        finePerMiss: seasons.finePerMiss,
        weekStartDay: seasons.weekStartDay,
        dayStartTime: seasons.dayStartTime,
        dailyDuplicatePolicy: seasons.dailyDuplicatePolicy,
      })
      .from(seasons)
      .where(eq(seasons.id, post.seasonId))
      .limit(1);
    const season = seasonRows[0];

    if (!season) {
      return;
    }

    const workoutDate = getKoreanWorkoutDate(post.createdAt, season.dayStartTime);
    const period = getKoreanWeekRange(workoutDate, season.weekStartDay);
    const settlementRows = await tx
      .select({ id: weeklySettlements.id, status: weeklySettlements.status })
      .from(weeklySettlements)
      .where(and(eq(weeklySettlements.seasonId, season.id), eq(weeklySettlements.weekStartDate, period.weekStartDate)))
      .limit(1);
    const settlement = settlementRows[0];

    if (!settlement || settlement.status !== "draft") {
      return;
    }

    const calculatedRow = await calculateSettlementRowForUser(tx, season, post.userId, period);
    await tx
      .insert(weeklySettlementRows)
      .values({ settlementId: settlement.id, ...calculatedRow, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [weeklySettlementRows.settlementId, weeklySettlementRows.userId],
        set: {
          validWorkoutCount: calculatedRow.validWorkoutCount,
          missedCount: calculatedRow.missedCount,
          autoFineAmount: calculatedRow.autoFineAmount,
          finalFineAmount: calculatedRow.finalFineAmount,
          dailyResults: calculatedRow.dailyResults,
          updatedAt: new Date(),
        },
      });
  });
}

async function getDueSeasons(now: Date): Promise<DueSeason[]> {
  return db
    .select({
      id: seasons.id,
      groupId: seasons.groupId,
      name: seasons.name,
      targetWorkoutCountPerWeek: seasons.targetWorkoutCountPerWeek,
      finePerMiss: seasons.finePerMiss,
      weekStartDay: seasons.weekStartDay,
      dayStartTime: seasons.dayStartTime,
      dailyDuplicatePolicy: seasons.dailyDuplicatePolicy,
      nextSettlementAt: seasons.nextSettlementAt,
    })
    .from(seasons)
    .where(and(eq(seasons.status, "active"), or(isNull(seasons.nextSettlementAt), lte(seasons.nextSettlementAt, now))))
    .orderBy(asc(seasons.nextSettlementAt), asc(seasons.id));
}

async function processDueSeason(season: DueSeason, now: Date) {
  return db.transaction(async (tx) => {
    if (!season.nextSettlementAt) {
      const nextSettlementAt = getNextSettlementAt(now, season.weekStartDay, season.dayStartTime);
      await tx
        .update(seasons)
        .set({ nextSettlementAt, updatedAt: new Date() })
        .where(and(eq(seasons.id, season.id), eq(seasons.status, "active"), isNull(seasons.nextSettlementAt)));

      return { status: "initialized" as const, nextSettlementAt: nextSettlementAt.toISOString() };
    }

    const period = getPreviousSettlementPeriod(season.nextSettlementAt, season.weekStartDay, season.dayStartTime);
    const window = getSettlementWindow(period.weekStartDate, season.dayStartTime);
    const settlement = await getOrCreateSettlement(tx, season, period);
    const participantUserIds = await getParticipantUserIds(tx, season.id, period.weekStartDate, period.weekEndDate);

    if (settlement.status === "draft") {
      const settlementRows = await calculateSettlementRows(tx, season, participantUserIds, period, window.startAt, window.endAt);
      await upsertDraftSettlementRows(tx, settlement.id, settlementRows);
      if (settlement.created) {
        await notifyWeeklySettlementCreated(tx, settlement.id, season.groupId, participantUserIds);
      }
    }

    const nextSettlementAt = getNextSettlementAtAfter(season.nextSettlementAt, season.weekStartDay, season.dayStartTime);
    await tx
      .update(seasons)
      .set({ nextSettlementAt, updatedAt: new Date() })
      .where(and(eq(seasons.id, season.id), eq(seasons.nextSettlementAt, season.nextSettlementAt), eq(seasons.status, "active")));

    return {
      status: "settled" as const,
      weekStartDate: period.weekStartDate,
      weekEndDate: period.weekEndDate,
      participantCount: participantUserIds.length,
      nextSettlementAt: nextSettlementAt.toISOString(),
    };
  });
}

async function getOrCreateSettlement(tx: BatchTransaction, season: DueSeason, period: SettlementPeriod) {
  const insertedRows = await tx
    .insert(weeklySettlements)
    .values({
      groupId: season.groupId,
      seasonId: season.id,
      weekStartDate: period.weekStartDate,
      weekEndDate: period.weekEndDate,
      status: "draft",
    })
    .onConflictDoNothing()
    .returning({ id: weeklySettlements.id, status: weeklySettlements.status });

  if (insertedRows[0]) {
    return { ...insertedRows[0], created: true };
  }

  const existingRows = await tx
    .select({ id: weeklySettlements.id, status: weeklySettlements.status })
    .from(weeklySettlements)
    .where(and(eq(weeklySettlements.seasonId, season.id), eq(weeklySettlements.weekStartDate, period.weekStartDate)))
    .limit(1);

  if (!existingRows[0]) {
    throw new Error("Weekly settlement was not created.");
  }

  return { ...existingRows[0], created: false };
}

async function notifyWeeklySettlementCreated(tx: BatchTransaction, settlementId: bigint, groupId: bigint, participantUserIds: bigint[]) {
  if (participantUserIds.length === 0) {
    return;
  }

  const groupRows = await tx.select({ name: groups.name }).from(groups).where(eq(groups.id, groupId)).limit(1);
  const groupName = groupRows[0]?.name;
  const message = groupName ? `[${groupName}] 지난 주 결산이 도착했어요.` : "지난 주 결산이 도착했어요.";
  const rows = await tx
    .insert(notifications)
    .values(
      participantUserIds.map((userId) => ({
        recipientUserId: userId,
        groupId,
        type: "weekly_settlement_created",
        message,
        actionType: "settlement_detail",
        actionTargetId: settlementId.toString(),
      })),
    )
    .returning({
      notificationId: notifications.id,
      recipientUserId: notifications.recipientUserId,
      message: notifications.message,
      actionType: notifications.actionType,
      actionTargetId: notifications.actionTargetId,
      groupId: notifications.groupId,
    });

  await sendPushForNotifications(rows);
}

async function upsertDraftSettlementRows(tx: BatchTransaction, settlementId: bigint, settlementRows: CalculatedSettlementRow[]) {
  if (settlementRows.length === 0) {
    return;
  }

  await tx
    .insert(weeklySettlementRows)
    .values(settlementRows.map((row) => ({ settlementId, ...row, updatedAt: new Date() })))
    .onConflictDoUpdate({
      target: [weeklySettlementRows.settlementId, weeklySettlementRows.userId],
      set: {
        validWorkoutCount: sql.raw(`excluded.${weeklySettlementRows.validWorkoutCount.name}`),
        missedCount: sql.raw(`excluded.${weeklySettlementRows.missedCount.name}`),
        autoFineAmount: sql.raw(`excluded.${weeklySettlementRows.autoFineAmount.name}`),
        finalFineAmount: sql.raw(`excluded.${weeklySettlementRows.finalFineAmount.name}`),
        dailyResults: sql.raw(`excluded.${weeklySettlementRows.dailyResults.name}`),
        updatedAt: new Date(),
      },
    });
}

async function getParticipantUserIds(tx: BatchTransaction, seasonId: bigint, weekStartDate: string, weekEndDate: string) {
  const rows = await tx
    .select({ userId: seasonParticipantPeriods.userId })
    .from(seasonParticipantPeriods)
    .where(
      and(
        eq(seasonParticipantPeriods.seasonId, seasonId),
        lte(seasonParticipantPeriods.startDate, weekEndDate),
        or(isNull(seasonParticipantPeriods.endDate), gte(seasonParticipantPeriods.endDate, weekStartDate)),
      ),
    )
    .orderBy(asc(seasonParticipantPeriods.userId));

  return Array.from(new Map(rows.map((row) => [row.userId.toString(), row.userId])).values());
}

async function calculateSettlementRows(
  tx: BatchTransaction,
  season: SettlementSeason,
  participantUserIds: bigint[],
  period: SettlementPeriod,
  windowStartAt: Date,
  windowEndAt: Date,
) {
  if (participantUserIds.length === 0) {
    return [];
  }

  const posts = await getWorkoutPostsForSettlement(tx, season, participantUserIds, windowStartAt, windowEndAt);
  return participantUserIds.map((userId) => calculateSettlementRow(season, userId, period, posts.filter((post) => post.userId === userId)));
}

async function calculateSettlementRowForUser(tx: BatchTransaction, season: SettlementSeason, userId: bigint, period: SettlementPeriod) {
  const window = getSettlementWindow(period.weekStartDate, season.dayStartTime);
  const posts = await getWorkoutPostsForSettlement(tx, season, [userId], window.startAt, window.endAt);
  return calculateSettlementRow(season, userId, period, posts);
}

async function getWorkoutPostsForSettlement(
  tx: BatchTransaction,
  season: SettlementSeason,
  participantUserIds: bigint[],
  windowStartAt: Date,
  windowEndAt: Date,
) {
  return tx
    .select({ id: workoutPosts.id, userId: workoutPosts.userId, createdAt: workoutPosts.createdAt })
    .from(workoutPosts)
    .where(
      and(
        eq(workoutPosts.groupId, season.groupId),
        eq(workoutPosts.seasonId, season.id),
        inArray(workoutPosts.userId, participantUserIds),
        eq(workoutPosts.isInvalid, false),
        isNull(workoutPosts.deletedAt),
        gte(workoutPosts.createdAt, windowStartAt),
        lt(workoutPosts.createdAt, windowEndAt),
      ),
    )
    .orderBy(asc(workoutPosts.createdAt), asc(workoutPosts.id));
}

function calculateSettlementRow(
  season: SettlementSeason,
  userId: bigint,
  period: SettlementPeriod,
  posts: SettlementWorkoutPost[],
): CalculatedSettlementRow {
  const { dailyResults, validWorkoutCount } = calculateDailyWorkouts(posts, season, period);
  const missedCount = Math.max(season.targetWorkoutCountPerWeek - validWorkoutCount, 0);
  const autoFineAmount = missedCount * season.finePerMiss;

  return {
    userId,
    validWorkoutCount,
    missedCount,
    autoFineAmount,
    finalFineAmount: autoFineAmount,
    dailyResults,
  };
}

async function acquireBatchLock() {
  const rows = await db.execute(sql`SELECT pg_try_advisory_lock(${WEEKLY_SETTLEMENT_BATCH_LOCK_KEY}) AS locked`);
  return Boolean((rows as unknown as Array<{ locked: boolean }>)[0]?.locked);
}

async function releaseBatchLock() {
  await db.execute(sql`SELECT pg_advisory_unlock(${WEEKLY_SETTLEMENT_BATCH_LOCK_KEY})`);
}

function log(message: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level: "info", batch: "weekly-settlement", message, ...data }));
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }

  return { message: String(error) };
}
