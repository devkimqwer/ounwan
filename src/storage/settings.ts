import "server-only";

import path from "node:path";

import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { appSettings } from "@/db/schema";

export const localUploadRootSettingKey = "local_upload_root";

export async function getLocalUploadRoot() {
  const rows = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, localUploadRootSettingKey))
    .limit(1);

  const root = rows[0]?.value.trim();

  if (!root) {
    throw new Error("local_upload_root app setting is required. Run seed or configure app_settings.");
  }

  if (!path.isAbsolute(root)) {
    throw new Error("local_upload_root app setting must be an absolute path.");
  }

  return root;
}
