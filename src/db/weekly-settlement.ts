import { and, asc, eq, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";

import {
  getKoreanWorkoutDate,
  getNextSettlementAt,
  getNextSettlementAtAfter,
  getPreviousSettlementPeriod,
  getSettlementWindow,
} from "../lib/season-time";
import { db } from "./database";
import { seasonParticipantPeriods, seasons, weeklySettlementRows, weeklySettlements, workoutPosts } from "./schema";

const WEEKLY_SETTLEMENT_BATCH_LOCK_KEY = 90314001;

export type WeeklySettlementBatchResult = {
  status: "completed" | "skipped";
  dueCount: number;
  successCount: number;
  failureCount: number;
  initializedCount: number;
};

type DueSeason = {
  id: bigint;
  groupId: bigint;
  name: string;
  targetWorkoutCountPerWeek: number;
  finePerMiss: number;
  weekStartDay: number;
  dayStartTime: string;
  dailyDuplicatePolicy: "count_once" | "count_all";
  nextSettlementAt: Date | null;
};

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
    const settlementId = await getOrCreateSettlement(tx, season, period);
    const participantUserIds = await getParticipantUserIds(tx, season.id, period.weekStartDate, period.weekEndDate);
    const workoutCounts = await getWorkoutCounts(tx, season, participantUserIds, period.weekStartDate, period.weekEndDate, window.startAt, window.endAt);

    if (participantUserIds.length > 0) {
      await tx
        .insert(weeklySettlementRows)
        .values(
          participantUserIds.map((userId) => {
            const validWorkoutCount = workoutCounts.get(userId.toString()) ?? 0;
            const missedCount = Math.max(season.targetWorkoutCountPerWeek - validWorkoutCount, 0);
            const autoFineAmount = missedCount * season.finePerMiss;

            return {
              settlementId,
              userId,
              validWorkoutCount,
              missedCount,
              autoFineAmount,
              finalFineAmount: autoFineAmount,
            };
          }),
        )
        .onConflictDoNothing();
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

type BatchTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function getOrCreateSettlement(tx: BatchTransaction, season: DueSeason, period: { weekStartDate: string; weekEndDate: string }) {
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
    .returning({ id: weeklySettlements.id });

  if (insertedRows[0]) {
    return insertedRows[0].id;
  }

  const existingRows = await tx
    .select({ id: weeklySettlements.id })
    .from(weeklySettlements)
    .where(and(eq(weeklySettlements.seasonId, season.id), eq(weeklySettlements.weekStartDate, period.weekStartDate)))
    .limit(1);

  if (!existingRows[0]) {
    throw new Error("Weekly settlement was not created.");
  }

  return existingRows[0].id;
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

async function getWorkoutCounts(
  tx: BatchTransaction,
  season: DueSeason,
  participantUserIds: bigint[],
  weekStartDate: string,
  weekEndDate: string,
  windowStartAt: Date,
  windowEndAt: Date,
) {
  const counts = new Map<string, number>();

  if (participantUserIds.length === 0) {
    return counts;
  }

  const rows = await tx
    .select({ userId: workoutPosts.userId, createdAt: workoutPosts.createdAt })
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
    );

  if (season.dailyDuplicatePolicy === "count_all") {
    for (const row of rows) {
      const userId = row.userId.toString();
      const businessDate = getKoreanWorkoutDate(row.createdAt, season.dayStartTime);

      if (businessDate >= weekStartDate && businessDate <= weekEndDate) {
        counts.set(userId, (counts.get(userId) ?? 0) + 1);
      }
    }

    return counts;
  }

  const datesByUserId = new Map<string, Set<string>>();

  for (const row of rows) {
    const userId = row.userId.toString();
    const businessDate = getKoreanWorkoutDate(row.createdAt, season.dayStartTime);

    if (businessDate < weekStartDate || businessDate > weekEndDate) {
      continue;
    }

    const dates = datesByUserId.get(userId) ?? new Set<string>();
    dates.add(businessDate);
    datesByUserId.set(userId, dates);
  }

  for (const [userId, dates] of datesByUserId.entries()) {
    counts.set(userId, dates.size);
  }

  return counts;
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
