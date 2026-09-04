import "server-only";

import { db } from "@/db/client";
import { oauthAccounts, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { saveUserAvatarSvg } from "@/storage/local";

const defaultAvatarColor = "#5e4ea5";

export async function findUserIdByKakaoId(kakaoId: string) {
  const rows = await db
    .select({ userId: oauthAccounts.userId })
    .from(oauthAccounts)
    .where(and(eq(oauthAccounts.provider, "kakao"), eq(oauthAccounts.providerUserId, kakaoId)))
    .limit(1);

  return rows[0]?.userId.toString();
}

export async function registerKakaoUser(input: { kakaoId: string; displayName: string }) {
  const existingUserId = await findUserIdByKakaoId(input.kakaoId);
  if (existingUserId) {
    return existingUserId;
  }

  const userRows = await db
    .insert(users)
    .values({ displayName: input.displayName, avatarColor: defaultAvatarColor })
    .returning({ id: users.id });
  const userId = userRows[0].id;

  await db.insert(oauthAccounts).values({
    userId,
    provider: "kakao",
    providerUserId: input.kakaoId,
  });

  const avatarStorageKey = await saveUserAvatarSvg(userId.toString()).catch(() => undefined);
  if (avatarStorageKey) {
    await db.update(users).set({ avatarStorageKey, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  return userId.toString();
}