import { NextRequest, NextResponse } from "next/server";

import { exchangeKakaoToken, fetchKakaoUser } from "@/auth/kakao";
import { findUserIdByKakaoId } from "@/auth/users";
import { consumeOAuthReturnTo, setPendingKakaoId, setSessionUserId, verifyOAuthState } from "@/auth/session";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code) {
    return NextResponse.json({ error: "인가 코드가 없습니다." }, { status: 400 });
  }

  if (!(await verifyOAuthState(state))) {
    return NextResponse.json({ error: "카카오 로그인 요청을 확인할 수 없습니다." }, { status: 400 });
  }

  try {
    const returnTo = await consumeOAuthReturnTo();
    const tokenData = await exchangeKakaoToken(request, code);
    const userData = await fetchKakaoUser(tokenData.access_token);
    const kakaoId = String(userData.id);
    const userId = await findUserIdByKakaoId(kakaoId);

    if (userId) {
      await setSessionUserId(userId);
      return NextResponse.redirect(new URL(returnTo ?? "/", request.nextUrl.origin));
    }

    await setPendingKakaoId(kakaoId, returnTo);
    return NextResponse.redirect(new URL("/profile/setup", request.nextUrl.origin));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "카카오 로그인 처리 중 문제가 발생했습니다." }, { status: 500 });
  }
}