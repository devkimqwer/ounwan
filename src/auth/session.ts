import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const sessionCookieName = "ounwan_session";
const currentGroupCookieName = "ounwan_current_group";
const pendingKakaoCookieName = "ounwan_pending_kakao";
const oauthStateCookieName = "ounwan_oauth_state";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;
const pendingMaxAgeSeconds = 60 * 15;
const oauthReturnToCookieName = "ounwan_oauth_return_to";
const stateMaxAgeSeconds = 60 * 10;

type SessionPayload = {
  userId: string;
  expiresAt: number;
};

type CurrentGroupPayload = {
  userId: string;
  groupId: string;
  expiresAt: number;
};

type PendingKakaoPayload = {
  kakaoId: string;
  returnTo?: string;
  expiresAt: number;
};

type OAuthReturnToPayload = {
  returnTo: string;
  expiresAt: number;
};

export async function getCurrentUserId() {
  const payload = await readSignedCookie<SessionPayload>(sessionCookieName);
  if (!payload || payload.expiresAt < Date.now()) {
    return undefined;
  }

  return payload.userId;
}

export async function requireCurrentUserId() {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("Login is required.");
  }

  return userId;
}

export async function setSessionUserId(userId: string) {
  await writeSignedCookie(sessionCookieName, { userId, expiresAt: Date.now() + sessionMaxAgeSeconds * 1000 }, sessionMaxAgeSeconds);
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieName);
  cookieStore.delete(currentGroupCookieName);
}

export async function getCurrentGroupIdForUser(userId: string) {
  const payload = await readSignedCookie<CurrentGroupPayload>(currentGroupCookieName);
  if (!payload || payload.expiresAt < Date.now() || payload.userId !== userId) {
    return undefined;
  }

  return payload.groupId;
}

export async function setCurrentGroupIdForUser(userId: string, groupId: string) {
  await writeSignedCookie(
    currentGroupCookieName,
    { userId, groupId, expiresAt: Date.now() + sessionMaxAgeSeconds * 1000 },
    sessionMaxAgeSeconds,
  );
}

export async function createOAuthState(returnTo?: string) {
  const state = randomBytes(24).toString("base64url");
  const cookieStore = await cookies();
  cookieStore.set(oauthStateCookieName, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: stateMaxAgeSeconds,
  });

  if (isSafeReturnPath(returnTo)) {
    await writeSignedCookie(
      oauthReturnToCookieName,
      { returnTo, expiresAt: Date.now() + stateMaxAgeSeconds * 1000 },
      stateMaxAgeSeconds,
    );
  } else {
    cookieStore.delete(oauthReturnToCookieName);
  }

  return state;
}

export async function verifyOAuthState(state: string | null) {
  const cookieStore = await cookies();
  const storedState = cookieStore.get(oauthStateCookieName)?.value;
  cookieStore.delete(oauthStateCookieName);

  return Boolean(state && storedState && timingSafeEqualText(state, storedState));
}

export async function setPendingKakaoId(kakaoId: string, returnTo?: string) {
  await writeSignedCookie(
    pendingKakaoCookieName,
    { kakaoId, returnTo: isSafeReturnPath(returnTo) ? returnTo : undefined, expiresAt: Date.now() + pendingMaxAgeSeconds * 1000 },
    pendingMaxAgeSeconds,
  );
}

export async function getPendingKakaoId() {
  const payload = await readSignedCookie<PendingKakaoPayload>(pendingKakaoCookieName);
  if (!payload || payload.expiresAt < Date.now()) {
    return undefined;
  }

  return payload.kakaoId;
}

export async function getPendingKakaoReturnTo() {
  const payload = await readSignedCookie<PendingKakaoPayload>(pendingKakaoCookieName);
  if (!payload || payload.expiresAt < Date.now() || !isSafeReturnPath(payload.returnTo)) {
    return undefined;
  }

  return payload.returnTo;
}

export async function consumeOAuthReturnTo() {
  const payload = await readSignedCookie<OAuthReturnToPayload>(oauthReturnToCookieName);
  const cookieStore = await cookies();
  cookieStore.delete(oauthReturnToCookieName);

  if (!payload || payload.expiresAt < Date.now() || !isSafeReturnPath(payload.returnTo)) {
    return undefined;
  }

  return payload.returnTo;
}

export async function clearPendingKakaoId() {
  const cookieStore = await cookies();
  cookieStore.delete(pendingKakaoCookieName);
}

async function readSignedCookie<T>(name: string) {
  const cookieStore = await cookies();
  const value = cookieStore.get(name)?.value;
  if (!value) {
    return undefined;
  }

  return verifySignedValue<T>(value);
}

async function writeSignedCookie(name: string, payload: unknown, maxAge: number) {
  const cookieStore = await cookies();
  cookieStore.set(name, signPayload(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

function signPayload(payload: unknown) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getSessionSecret()).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function verifySignedValue<T>(value: string) {
  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) {
    return undefined;
  }

  const expectedSignature = createHmac("sha256", getSessionSecret()).update(encodedPayload).digest("base64url");
  if (!timingSafeEqualText(signature, expectedSignature)) {
    return undefined;
  }

  try {
    return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as T;
  } catch {
    return undefined;
  }
}

function getSessionSecret() {
  const secret = process.env.OUNWAN_SESSION_SECRET ?? process.env.KAKAO_CLIENT_SECRET ?? process.env.KAKAO_REST_API_KEY;
  if (!secret) {
    throw new Error("OUNWAN_SESSION_SECRET or Kakao client secret is required.");
  }

  return secret;
}

function timingSafeEqualText(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
function isSafeReturnPath(value: string | undefined): value is string {
  return Boolean(value && value.startsWith("/") && !value.startsWith("//"));
}