import "server-only";

import { randomBytes } from "node:crypto";

const INVITE_TOKEN_BYTES = 32;
const inviteTokenPattern = /^[A-Za-z0-9_-]{32,120}$/;

export function generateInviteToken() {
  return randomBytes(INVITE_TOKEN_BYTES).toString("base64url");
}

export function isInviteTokenFormat(value: string) {
  return inviteTokenPattern.test(value);
}
