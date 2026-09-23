import "server-only";

import { NextRequest } from "next/server";

export type KakaoTokenResponse = {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  refresh_token_expires_in?: number;
};

export type KakaoUserResponse = {
  id: number;
};

export function getKakaoAuthorizeUrl(request: NextRequest, state: string) {
  const clientId = getKakaoClientId();
  const redirectUri = getKakaoRedirectUri(request);
  const url = new URL("https://kauth.kakao.com/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  return url;
}

export async function exchangeKakaoToken(request: NextRequest, code: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: getKakaoClientId(),
    redirect_uri: getKakaoRedirectUri(request),
    code,
  });
  const clientSecret = process.env.KAKAO_CLIENT_SECRET;
  if (clientSecret) {
    body.set("client_secret", clientSecret);
  }

  const response = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body,
  });

  if (!response.ok) {
    throw new Error(`Kakao token request failed: ${response.status}`);
  }

  return (await response.json()) as KakaoTokenResponse;
}

export async function fetchKakaoUser(accessToken: string) {
  const response = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Kakao user request failed: ${response.status}`);
  }

  return (await response.json()) as KakaoUserResponse;
}

export function validateKakaoUnlinkConfiguration() {
  getKakaoAdminKey();
}

export async function unlinkKakaoAccount(kakaoId: string) {
  if (!/^\d+$/.test(kakaoId)) {
    throw new Error("Invalid Kakao account id.");
  }
  const response = await fetch("https://kapi.kakao.com/v1/user/unlink", {
    method: "POST",
    headers: {
      Authorization: `KakaoAK ${getKakaoAdminKey()}`,
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: new URLSearchParams({ target_id_type: "user_id", target_id: kakaoId }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const result = await response.json() as { id?: number | string; code?: number };
  // 연결해제 후 DB 저장이 실패한 경우에도 재시도할 수 있도록 이미 해제된 계정을 허용한다.
  if (response.status === 400 && result.code === -101) {
    return;
  }
  if (!response.ok || String(result.id) !== kakaoId) {
    throw new Error(`Kakao unlink failed: status=${response.status}, code=${result.code ?? "unknown"}`);
  }
}

function getKakaoAdminKey() {
  const key = process.env.KAKAO_ADMIN_KEY?.trim();
  if (!key) {
    throw new Error("KAKAO_ADMIN_KEY is required.");
  }
  return key;
}

function getKakaoClientId() {
  const clientId = process.env.KAKAO_REST_API_KEY;
  if (!clientId) {
    throw new Error("KAKAO_REST_API_KEY is required.");
  }

  return clientId;
}

export function getAppOrigin(request: NextRequest) {
  const configuredOrigin = process.env.OUNWAN_APP_ORIGIN?.trim();
  return configuredOrigin || request.nextUrl.origin;
}

function getKakaoRedirectUri(request: NextRequest) {
  return process.env.KAKAO_REDIRECT_URI ?? new URL("/api/auth/kakao/callback", getAppOrigin(request)).toString();
}
