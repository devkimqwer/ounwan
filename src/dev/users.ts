import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import { users } from "@/db/schema";
import { assertDevAuthEnabled } from "./auth";

export async function findActiveDevUser(userId: string) {
  assertDevAuthEnabled();

  if (!/^\d+$/.test(userId)) {
    return undefined;
  }

  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, BigInt(userId)), eq(users.status, "active"), isNull(users.deletedAt)))
    .limit(1);

  return rows[0]?.id.toString();
}