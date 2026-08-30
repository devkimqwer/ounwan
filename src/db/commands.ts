import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "./client";
import { groupMembers, oauthAccounts, seasons, users, workoutPosts } from "./schema";

const seedCurrentKakaoId = "kakao-1";

type CreateWorkoutPostInput = {
  workoutType: string;
  content?: string;
};

export async function createWorkoutPost(input: CreateWorkoutPostInput) {
  const context = await getCurrentSeedContext();

  const rows = await db
    .insert(workoutPosts)
    .values({
      groupId: BigInt(context.groupId),
      seasonId: BigInt(context.seasonId),
      userId: BigInt(context.userId),
      workoutDate: getKoreanWorkoutDate(),
      workoutType: input.workoutType,
      content: input.content,
    })
    .returning({ id: workoutPosts.id });

  return { id: rows[0].id.toString() };
}

async function getCurrentSeedContext() {
  const userRows = await db
    .select({ id: users.id })
    .from(oauthAccounts)
    .innerJoin(users, eq(oauthAccounts.userId, users.id))
    .where(and(eq(oauthAccounts.provider, "kakao"), eq(oauthAccounts.providerUserId, seedCurrentKakaoId)))
    .limit(1);

  if (!userRows[0]) {
    throw new Error("Seed current user not found. Run npm run db:seed:local first.");
  }

  const membershipRows = await db
    .select({ groupId: groupMembers.groupId, userId: groupMembers.userId })
    .from(groupMembers)
    .where(and(eq(groupMembers.userId, userRows[0].id), isNull(groupMembers.leftAt)))
    .limit(1);

  if (!membershipRows[0]) {
    throw new Error("Current user membership not found. Run npm run db:seed:local first.");
  }

  const seasonRows = await db
    .select({ id: seasons.id })
    .from(seasons)
    .where(and(eq(seasons.groupId, membershipRows[0].groupId), eq(seasons.status, "active")))
    .limit(1);

  if (!seasonRows[0]) {
    throw new Error("Active season not found. Run npm run db:seed:local first.");
  }

  return {
    userId: membershipRows[0].userId.toString(),
    groupId: membershipRows[0].groupId.toString(),
    seasonId: seasonRows[0].id.toString(),
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

