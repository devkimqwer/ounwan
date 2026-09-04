import { NextRequest, NextResponse } from "next/server";

import { getKakaoAuthorizeUrl } from "@/auth/kakao";
import { createOAuthState } from "@/auth/session";

export async function GET(request: NextRequest) {
  const state = await createOAuthState();
  return NextResponse.redirect(getKakaoAuthorizeUrl(request, state));
}