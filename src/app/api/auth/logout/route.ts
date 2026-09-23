import { NextRequest, NextResponse } from "next/server";

import { clearSession } from "@/auth/session";
import { getAppOrigin } from "@/app-origin";

export async function POST(request: NextRequest) {
  await clearSession();
  return NextResponse.redirect(new URL("/", getAppOrigin(request)), 303);
}
