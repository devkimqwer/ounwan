import { NextRequest, NextResponse } from "next/server";

import { exchangeKakaoToken, fetchKakaoUser, getAppOrigin } from "@/auth/kakao";
import { getKakaoAccountAuthState } from "@/auth/users";
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
    const appOrigin = getAppOrigin(request);
    const tokenData = await exchangeKakaoToken(request, code);
    const userData = await fetchKakaoUser(tokenData.access_token);
    const kakaoId = String(userData.id);
    const accountState = await getKakaoAccountAuthState(kakaoId);

    if (accountState.status === "active") {
      await setSessionUserId(accountState.userId);
      return NextResponse.redirect(new URL(returnTo ?? "/", appOrigin));
    }

    if (accountState.status === "blocked") {
      return NextResponse.redirect(new URL("/?authError=blocked", appOrigin));
    }

    await setPendingKakaoId(kakaoId, returnTo);
    return NextResponse.redirect(new URL("/profile/setup", appOrigin));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "카카오 로그인 처리 중 문제가 발생했습니다." }, { status: 500 });
  }
}
