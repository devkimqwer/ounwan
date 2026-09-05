import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  appSettings,
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
  seasonParticipantPeriods,
  seasons,
  users,
  weeklySettlementRows,
  weeklySettlements,
  workoutPosts,
} from "./schema";

function getDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const host = process.env.POSTGRES_HOST;
  const port = process.env.POSTGRES_PORT;
  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  const database = process.env.POSTGRES_DB;

  if (!host || !port || !user || !password || !database) {
    throw new Error("POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DB are required.");
  }

  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}`;
}

const queryClient = postgres(getDatabaseUrl(), { max: 1 });
const db = drizzle(queryClient);

const seedUsers = [
  { key: "user-1", kakaoId: "kakao-1", displayName: "김지수" },
  { key: "user-2", kakaoId: "kakao-2", displayName: "박은영" },
  { key: "user-3", kakaoId: "kakao-3", displayName: "이철수" },
  { key: "user-4", kakaoId: "kakao-4", displayName: "최민준" },
  { key: "user-5", kakaoId: "kakao-5", displayName: "정수아" },
  { key: "user-6", kakaoId: "kakao-6", displayName: "한태양" },
] as const;

type UserKey = (typeof seedUsers)[number]["key"];
type MemberRole = "admin" | "treasurer" | "member";

interface SeedMembership {
  userKey: UserKey;
  roles: MemberRole[];
  joinedAt: string;
}

interface SeedPost {
  key: string;
  userKey: UserKey;
  workoutDate: string;
  createdAt: Date;
  content: string;
  workoutType: string;
  isInvalid: boolean;
  mediaUrl: string;
  invalidatedByUserKey?: UserKey;
  invalidatedAt?: Date;
}

const seedMemberships: SeedMembership[] = [
  { userKey: "user-1", roles: ["admin", "treasurer"], joinedAt: "2026-08-01" },
  { userKey: "user-2", roles: ["member"], joinedAt: "2026-08-01" },
  { userKey: "user-3", roles: ["member"], joinedAt: "2026-08-01" },
  { userKey: "user-4", roles: ["member"], joinedAt: "2026-08-05" },
  { userKey: "user-5", roles: ["member"], joinedAt: "2026-08-18" },
  { userKey: "user-6", roles: ["member"], joinedAt: "2026-08-10" },
];

const seedPosts: SeedPost[] = [
  {
    key: "post-1",
    userKey: "user-1",
    workoutDate: "2026-08-18",
    createdAt: new Date("2026-08-18T07:32:00+09:00"),
    content: "오늘도 달렸다. 5km 완주.",
    workoutType: "러닝",
    isInvalid: false,
    mediaUrl: "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=600&h=600&fit=crop&auto=format",
  },
  {
    key: "post-2",
    userKey: "user-2",
    workoutDate: "2026-08-18",
    createdAt: new Date("2026-08-18T18:45:00+09:00"),
    content: "상체 위주로 운동. 벤치프레스 개인 최고 기록.",
    workoutType: "헬스",
    isInvalid: false,
    mediaUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&h=600&fit=crop&auto=format",
  },
  {
    key: "post-3",
    userKey: "user-5",
    workoutDate: "2026-08-15",
    createdAt: new Date("2026-08-15T11:00:00+09:00"),
    content: "수영장 1000m 완료",
    workoutType: "수영",
    isInvalid: true,
    invalidatedByUserKey: "user-1",
    invalidatedAt: new Date("2026-08-15T13:20:00+09:00"),
    mediaUrl: "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=600&h=600&fit=crop&auto=format",
  },
];

const seedSettlementRows = [
  { userKey: "user-1", validWorkoutCount: 4, missedCount: 0, autoFineAmount: 0, finalFineAmount: 0 },
  { userKey: "user-2", validWorkoutCount: 2, missedCount: 1, autoFineAmount: 5000, finalFineAmount: 5000 },
  { userKey: "user-3", validWorkoutCount: 1, missedCount: 2, autoFineAmount: 10000, finalFineAmount: 10000 },
  { userKey: "user-5", validWorkoutCount: 0, missedCount: 3, autoFineAmount: 15000, finalFineAmount: 15000 },
] as const;

async function main() {
  const result = await db.transaction(async (tx) => {
    const userIds = new Map<string, bigint>();

    for (const seedUser of seedUsers) {
      const existing = await tx
        .select({ userId: oauthAccounts.userId })
        .from(oauthAccounts)
        .where(and(eq(oauthAccounts.provider, "kakao"), eq(oauthAccounts.providerUserId, seedUser.kakaoId)))
        .limit(1);

      if (existing[0]) {
        await tx
          .update(users)
          .set({ displayName: seedUser.displayName, updatedAt: new Date() })
          .where(eq(users.id, existing[0].userId));
        userIds.set(seedUser.key, existing[0].userId);
        continue;
      }

      const [createdUser] = await tx
        .insert(users)
        .values({ displayName: seedUser.displayName })
        .returning({ id: users.id });

      await tx.insert(oauthAccounts).values({
        userId: createdUser.id,
        provider: "kakao",
        providerUserId: seedUser.kakaoId,
      });

      userIds.set(seedUser.key, createdUser.id);
    }

    const ownerUserId = requiredId(userIds, "user-1", "user");
    const localUploadRoot = requiredEnv("LOCAL_UPLOAD_ROOT");
    await tx
      .insert(appSettings)
      .values({
        key: "local_upload_root",
        value: localUploadRoot,
        description: "로컬 파일 저장 루트 경로",
        updatedByUserId: ownerUserId,
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: localUploadRoot, updatedByUserId: ownerUserId, updatedAt: new Date() },
      });
    const existingGroups = await tx
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.name, "오운완"), eq(groups.ownerUserId, ownerUserId)))
      .limit(1);

    const groupId = existingGroups[0]?.id ?? (await tx
      .insert(groups)
      .values({ name: "오운완", visibility: "private", ownerUserId })
      .returning({ id: groups.id }))[0].id;

    await clearGroupData(tx, groupId);

    const [season] = await tx
      .insert(seasons)
      .values({
        groupId,
        name: "2026 시즌 3",
        startDate: "2026-08-01",
        targetWorkoutCountPerWeek: 3,
        finePerMiss: 5000,
        status: "active",
      })
      .returning({ id: seasons.id });

    for (const membership of seedMemberships) {
      const userId = requiredId(userIds, membership.userKey, "user");
      await tx.insert(groupMembers).values({ groupId, userId, roles: membership.roles, joinedAt: membership.joinedAt });
      await tx.insert(seasonParticipantPeriods).values({ seasonId: season.id, userId, startDate: membership.joinedAt });
    }

    const [invite] = await tx
      .insert(groupInvites)
      .values({
        groupId,
        inviteToken: "seed-invite-ounwan-2026-3",
        createdByUserId: ownerUserId,
        status: "active",
      })
      .returning({ id: groupInvites.id });

    await tx.insert(groupJoinRequests).values({
      groupId,
      inviteId: invite.id,
      userId: requiredId(userIds, "user-6", "user"),
      status: "approved",
      reviewedByUserId: ownerUserId,
      reviewedAt: new Date("2026-08-10T09:00:00+09:00"),
    });

    const postIds = new Map<string, bigint>();

    for (const seedPost of seedPosts) {
      const [post] = await tx
        .insert(workoutPosts)
        .values({
          groupId,
          seasonId: season.id,
          userId: requiredId(userIds, seedPost.userKey, "user"),
          workoutDate: seedPost.workoutDate,
          workoutType: seedPost.workoutType,
          content: seedPost.content,
          isInvalid: seedPost.isInvalid,
          invalidatedByUserId: seedPost.invalidatedByUserKey ? requiredId(userIds, seedPost.invalidatedByUserKey, "user") : null,
          invalidatedAt: seedPost.invalidatedAt ?? null,
          createdAt: seedPost.createdAt,
          updatedAt: seedPost.createdAt,
        })
        .returning({ id: workoutPosts.id });

      postIds.set(seedPost.key, post.id);

      await tx.insert(postMedia).values({
        postId: post.id,
        mediaType: "image",
        storageProvider: "local",
        storageKey: `seed/posts/${post.id.toString()}/image-1.jpg`,
        url: seedPost.mediaUrl,
        sortOrder: 1,
      });
    }

    await tx.insert(postLikes).values([
      { postId: requiredId(postIds, "post-1", "post"), userId: requiredId(userIds, "user-2", "user") },
      { postId: requiredId(postIds, "post-1", "post"), userId: requiredId(userIds, "user-3", "user") },
      { postId: requiredId(postIds, "post-1", "post"), userId: requiredId(userIds, "user-4", "user") },
      { postId: requiredId(postIds, "post-1", "post"), userId: requiredId(userIds, "user-5", "user") },
      { postId: requiredId(postIds, "post-2", "post"), userId: requiredId(userIds, "user-1", "user") },
      { postId: requiredId(postIds, "post-2", "post"), userId: requiredId(userIds, "user-3", "user") },
      { postId: requiredId(postIds, "post-2", "post"), userId: requiredId(userIds, "user-4", "user") },
      { postId: requiredId(postIds, "post-2", "post"), userId: requiredId(userIds, "user-5", "user") },
      { postId: requiredId(postIds, "post-2", "post"), userId: requiredId(userIds, "user-6", "user") },
      { postId: requiredId(postIds, "post-3", "post"), userId: requiredId(userIds, "user-1", "user") },
      { postId: requiredId(postIds, "post-3", "post"), userId: requiredId(userIds, "user-2", "user") },
    ]);

    await tx.insert(postComments).values([
      { postId: requiredId(postIds, "post-1", "post"), userId: requiredId(userIds, "user-2", "user"), content: "오오 5km 대단하다!", createdAt: new Date("2026-08-18T08:10:00+09:00") },
      { postId: requiredId(postIds, "post-1", "post"), userId: requiredId(userIds, "user-3", "user"), content: "나도 오늘 달려야겠다", createdAt: new Date("2026-08-18T09:22:00+09:00") },
      { postId: requiredId(postIds, "post-2", "post"), userId: requiredId(userIds, "user-1", "user"), content: "개인 최고 기록 축하!", createdAt: new Date("2026-08-18T19:03:00+09:00") },
    ]);

    const [settlement] = await tx
      .insert(weeklySettlements)
      .values({ groupId, seasonId: season.id, weekStartDate: "2026-08-10", weekEndDate: "2026-08-16", status: "draft" })
      .returning({ id: weeklySettlements.id });

    await tx.insert(weeklySettlementRows).values(
      seedSettlementRows.map((row) => ({
        settlementId: settlement.id,
        userId: requiredId(userIds, row.userKey, "user"),
        validWorkoutCount: row.validWorkoutCount,
        missedCount: row.missedCount,
        autoFineAmount: row.autoFineAmount,
        finalFineAmount: row.finalFineAmount,
      })),
    );

    await tx.insert(bankAccounts).values({
      groupId,
      bankName: "카카오뱅크",
      accountNumber: "3333-12-3456789",
      holderName: "김지수",
      updatedByUserId: ownerUserId,
    });

    await tx.insert(bankBalanceRecords).values({
      groupId,
      createdByUserId: ownerUserId,
      memo: "8월 2주차 결산 후 잔고 업데이트",
      imageStorageProvider: "local",
      imageStorageKey: "seed/bank/bank-1.jpg",
      imageUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&h=400&fit=crop&auto=format",
      createdAt: new Date("2026-08-18T14:30:00+09:00"),
    });

    return { users: userIds.size, groupId: groupId.toString(), seasonId: season.id.toString(), posts: postIds.size };
  });

  console.log("Seed completed", result);
}

async function clearGroupData(tx: any, groupId: bigint) {
  await tx.delete(bankBalanceRecords).where(eq(bankBalanceRecords.groupId, groupId));
  await tx.delete(bankAccounts).where(eq(bankAccounts.groupId, groupId));
  await tx.delete(groupJoinRequests).where(eq(groupJoinRequests.groupId, groupId));
  await tx.delete(groupInvites).where(eq(groupInvites.groupId, groupId));
  await tx.execute(sql`DELETE FROM ${postComments} USING ${workoutPosts} WHERE ${postComments.postId} = ${workoutPosts.id} AND ${workoutPosts.groupId} = ${groupId}`);
  await tx.execute(sql`DELETE FROM ${postLikes} USING ${workoutPosts} WHERE ${postLikes.postId} = ${workoutPosts.id} AND ${workoutPosts.groupId} = ${groupId}`);
  await tx.execute(sql`DELETE FROM ${postMedia} USING ${workoutPosts} WHERE ${postMedia.postId} = ${workoutPosts.id} AND ${workoutPosts.groupId} = ${groupId}`);
  await tx.delete(workoutPosts).where(eq(workoutPosts.groupId, groupId));
  await tx.execute(sql`DELETE FROM ${weeklySettlementRows} USING ${weeklySettlements} WHERE ${weeklySettlementRows.settlementId} = ${weeklySettlements.id} AND ${weeklySettlements.groupId} = ${groupId}`);
  await tx.delete(weeklySettlements).where(eq(weeklySettlements.groupId, groupId));
  await tx.execute(sql`DELETE FROM ${seasonParticipantPeriods} USING ${seasons} WHERE ${seasonParticipantPeriods.seasonId} = ${seasons.id} AND ${seasons.groupId} = ${groupId}`);
  await tx.delete(seasons).where(eq(seasons.groupId, groupId));
  await tx.delete(groupMembers).where(eq(groupMembers.groupId, groupId));
}


function requiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}
function requiredId(ids: Map<string, bigint>, key: string, label: string) {
  const id = ids.get(key);
  if (!id) {
    throw new Error(`Missing ${label} id for ${key}.`);
  }
  return id;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await queryClient.end();
  });
