import { NextResponse } from "next/server";

import { setSessionUserId } from "@/auth/session";
import { isDevAuthEnabled } from "@/dev/auth";
import { findActiveDevUser } from "@/dev/users";

export async function POST(request: Request) {
  if (!isDevAuthEnabled()) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const userId = String(formData.get("userId") ?? "").trim();
  const activeUserId = await findActiveDevUser(userId);

  if (!activeUserId) {
    return NextResponse.redirect(new URL("/?devLoginError=1", request.url), 303);
  }

  await setSessionUserId(activeUserId);
  return NextResponse.redirect(new URL("/", request.url), 303);
}