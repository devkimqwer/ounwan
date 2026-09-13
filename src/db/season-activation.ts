import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { getKoreanWeekRange, getNextSettlementAt, getSeasonLogicalStartAt, isSeasonStartDue } from "../lib/season-time";
import { db } from "./database";
import { groupMembers, seasonParticipantPeriods, seasons, weeklySettlementRows, weeklySettlements } from "./schema";

const SEASON_ACTIVATION_BATCH_LOCK_KEY = 90314002;

export type SeasonActivationResult = {
  status: "activated" | "skipped";
  reason?: "active_season_exists" | "pending_season_not_found" | "not_due" | "concurrent_update";
  seasonId?: bigint;
  groupId: bigint;
  logicalStartAt?: Date;
};

export type SeasonActivationBatchResult = {
  status: "completed" | "skipped";
  checkedCount: number;
  activatedCount: number;
  skippedCount: number;
  failureCount: number;
};

type SeasonActivationTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type PendingSeasonRow = {
  id: bigint;
  groupId: bigint;
  startDate: string;
  weekStartDay: number;
  dayStartTime: string;
};

export async function runPendingSeasonActivationBatch(now = new Date()): Promise<SeasonActivationBatchResult> {
  log("season activation batch started", { now: now.toISOString() });
  const locked = await acquireBatchLock();

  if (!locked) {
    log("season activation batch skipped", { reason: "batch lock is already held" });
    return { status: "skipped", checkedCount: 0, activatedCount: 0, skippedCount: 0, failureCount: 0 };
  }

  try {
    const pendingSeasons = await getDuePendingSeasons(now);
    log("pending seasons checked", { checkedCount: pendingSeasons.length });

    let activatedCount = 0;
    let skippedCount = 0;
    let failureCount = 0;

    for (const pendingSeason of pendingSeasons) {
      try {
        const result = await db.transaction((tx) => activatePendingSeasonForGroup(tx, pendingSeason.groupId, { now, requireStartDue: true }));

        if (result.status === "activated") {
          activatedCount += 1;
          log("season activated", formatActivationResult(result));
        } else {
          skippedCount += 1;
          log("season activation skipped", formatActivationResult(result));
        }
      } catch (error) {
        failureCount += 1;
        log("season activation failed", {
          seasonId: pendingSeason.id.toString(),
          groupId: pendingSeason.groupId.toString(),
          error: serializeError(error),
        });
      }
    }

    log("season activation batch completed", { checkedCount: pendingSeasons.length, activatedCount, skippedCount, failureCount });
    return { status: "completed", checkedCount: pendingSeasons.length, activatedCount, skippedCount, failureCount };
  } finally {
    await releaseBatchLock();
  }
}

export async function getDuePendingSeasons(now = new Date()): Promise<PendingSeasonRow[]> {
  return db
    .select({
      id: seasons.id,
      groupId: seasons.groupId,
      startDate: seasons.startDate,
      weekStartDay: seasons.weekStartDay,
      dayStartTime: seasons.dayStartTime,
    })
    .from(seasons)
    .where(
      and(
        eq(seasons.status, "pending"),
        sql`(${seasons.startDate}::timestamp + ${seasons.dayStartTime}) AT TIME ZONE 'Asia/Seoul' <= ${now}`,
      ),
    )
    .orderBy(asc(seasons.startDate), asc(seasons.id));
}

export async function activatePendingSeasonForGroup(
  tx: SeasonActivationTransaction,
  groupId: bigint,
  { now = new Date(), requireStartDue = false, activationDate }: { now?: Date; requireStartDue?: boolean; activationDate?: string } = {},
): Promise<SeasonActivationResult> {
  const activeSeasonRows = await tx
    .select({ id: seasons.id })
    .from(seasons)
    .where(and(eq(seasons.groupId, groupId), eq(seasons.status, "active")))
    .limit(1);

  if (activeSeasonRows[0]) {
    return { status: "skipped", reason: "active_season_exists", groupId };
  }

  const pendingSeasonRows = await tx
    .select({
      id: seasons.id,
      groupId: seasons.groupId,
      startDate: seasons.startDate,
      weekStartDay: seasons.weekStartDay,
      dayStartTime: seasons.dayStartTime,
    })
    .from(seasons)
    .where(and(eq(seasons.groupId, groupId), eq(seasons.status, "pending")))
    .orderBy(seasons.startDate, seasons.id)
    .limit(1);
  const pendingSeason = pendingSeasonRows[0];

  if (!pendingSeason) {
    return { status: "skipped", reason: "pending_season_not_found", groupId };
  }

  const scheduledStartAt = getSeasonLogicalStartAt(pendingSeason.startDate, pendingSeason.dayStartTime);

  if (requireStartDue && !isSeasonStartDue(pendingSeason.startDate, pendingSeason.dayStartTime, now)) {
    return { status: "skipped", reason: "not_due", seasonId: pendingSeason.id, groupId, logicalStartAt: scheduledStartAt };
  }

  const activatedSeasonRows = await tx
    .update(seasons)
    .set({ status: "active", startDate: activationDate ?? pendingSeason.startDate, updatedAt: new Date() })
    .where(and(eq(seasons.id, pendingSeason.id), eq(seasons.groupId, groupId), eq(seasons.status, "pending")))
    .returning({ id: seasons.id });
  const activatedSeason = activatedSeasonRows[0];

  if (!activatedSeason) {
    return { status: "skipped", reason: "concurrent_update", seasonId: pendingSeason.id, groupId, logicalStartAt: scheduledStartAt };
  }

  const effectiveStartDate = activationDate ?? pendingSeason.startDate;
  await initializeActiveSeason(tx, activatedSeason.id, groupId, effectiveStartDate, pendingSeason.weekStartDay, pendingSeason.dayStartTime);
  return { status: "activated", seasonId: activatedSeason.id, groupId, logicalStartAt: getSeasonLogicalStartAt(effectiveStartDate, pendingSeason.dayStartTime) };
}

export async function initializeActiveSeason(
  tx: SeasonActivationTransaction,
  seasonId: bigint,
  groupId: bigint,
  activationDate: string,
  weekStartDay: number,
  dayStartTime: string,
) {
  await tx
    .update(seasons)
    .set({ nextSettlementAt: getNextSettlementAt(getSeasonLogicalStartAt(activationDate, dayStartTime), weekStartDay, dayStartTime), updatedAt: new Date() })
    .where(eq(seasons.id, seasonId));

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

  const weekRange = getKoreanWeekRange(activationDate, weekStartDay);
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

async function acquireBatchLock() {
  const rows = await db.execute(sql`SELECT pg_try_advisory_lock(${SEASON_ACTIVATION_BATCH_LOCK_KEY}) AS locked`);
  return Boolean((rows as unknown as Array<{ locked: boolean }>)[0]?.locked);
}

async function releaseBatchLock() {
  await db.execute(sql`SELECT pg_advisory_unlock(${SEASON_ACTIVATION_BATCH_LOCK_KEY})`);
}

function formatActivationResult(result: SeasonActivationResult) {
  return {
    reason: result.reason,
    seasonId: result.seasonId?.toString(),
    groupId: result.groupId.toString(),
    logicalStartAt: result.logicalStartAt?.toISOString(),
  };
}

function log(message: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level: "info", batch: "season-activation", message, ...data }));
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }

  return { message: String(error) };
}
