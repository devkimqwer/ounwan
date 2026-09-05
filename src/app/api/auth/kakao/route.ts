import { NextRequest, NextResponse } from "next/server";

import { getKakaoAuthorizeUrl } from "@/auth/kakao";
import { createOAuthState } from "@/auth/session";

export async function GET(request: NextRequest) {
  const returnTo = request.nextUrl.searchParams.get("returnTo") ?? undefined;
  const state = await createOAuthState(returnTo);
  return NextResponse.redirect(getKakaoAuthorizeUrl(request, state));
}