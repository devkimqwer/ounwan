import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { oauthAccounts, users } from "@/db/schema";
import { generatePublicId, PUBLIC_ID_MAX_ATTEMPTS } from "@/lib/public-id";
import { saveUserAvatarSvg } from "@/storage/service";

export type KakaoAccountAuthState =
  | { status: "active"; userId: string }
  | { status: "blocked"; userId: string }
  | { status: "deleted"; userId: string }
  | { status: "none" };

export async function getKakaoAccountAuthState(kakaoId: string): Promise<KakaoAccountAuthState> {
  const rows = await db
    .select({
      userId: oauthAccounts.userId,
      userStatus: users.status,
      deletedAt: users.deletedAt,
    })
    .from(oauthAccounts)
    .innerJoin(users, eq(oauthAccounts.userId, users.id))
    .where(and(eq(oauthAccounts.provider, "kakao"), eq(oauthAccounts.providerUserId, kakaoId)))
    .limit(1);

  const account = rows[0];
  if (!account) {
    return { status: "none" };
  }

  const userId = account.userId.toString();
  if (account.userStatus === "blocked") {
    return { status: "blocked", userId };
  }

  if (account.userStatus === "deleted" || account.deletedAt) {
    return { status: "deleted", userId };
  }

  return { status: "active", userId };
}

export async function findUserIdByKakaoId(kakaoId: string) {
  const state = await getKakaoAccountAuthState(kakaoId);
  return state.status === "active" ? state.userId : undefined;
}

export async function registerKakaoUser(input: { kakaoId: string; displayName: string }) {
  const accountState = await getKakaoAccountAuthState(input.kakaoId);
  if (accountState.status === "active") {
    return accountState.userId;
  }

  if (accountState.status === "blocked") {
    throw new Error("Blocked Kakao account cannot register.");
  }

  const userId = await createUserWithPublicId(input.displayName);

  if (accountState.status === "deleted") {
    await db
      .update(oauthAccounts)
      .set({ userId })
      .where(and(eq(oauthAccounts.provider, "kakao"), eq(oauthAccounts.providerUserId, input.kakaoId)));
  } else {
    await db.insert(oauthAccounts).values({
      userId,
      provider: "kakao",
      providerUserId: input.kakaoId,
    });
  }

  const avatarStorageKey = await saveUserAvatarSvg(userId.toString()).catch(() => undefined);
  if (avatarStorageKey) {
    await db.update(users).set({ avatarStorageKey, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  return userId.toString();
}

async function createUserWithPublicId(displayName: string) {
  for (let attempt = 0; attempt < PUBLIC_ID_MAX_ATTEMPTS; attempt += 1) {
    const publicId = generatePublicId();
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.publicId, publicId)).limit(1);

    if (existing[0]) {
      continue;
    }

    const userRows = await db.insert(users).values({ displayName, publicId }).returning({ id: users.id });
    return userRows[0].id;
  }

  throw new Error("Could not generate unique public id.");
}
