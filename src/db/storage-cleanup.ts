import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { getConfiguredStorageAdapter } from "../storage/adapter";
import { db } from "./database";
import { bankBalanceRecords, postMedia, users, workoutPosts } from "./schema";

const STORAGE_CLEANUP_LOCK_KEY = 90314003;
const MIN_OBJECT_AGE_MS = 24 * 60 * 60 * 1000;

type CleanupTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type StorageCleanupResult = {
  status: "completed" | "skipped";
  dryRun: boolean;
  checkedCount: number;
  candidateCount: number;
  deletedCount: number;
  skippedCount: number;
  failureCount: number;
};

export async function runStorageCleanupBatch({ dryRun = false, now = new Date() }: { dryRun?: boolean; now?: Date } = {}): Promise<StorageCleanupResult> {
  const adapter = getConfiguredStorageAdapter();
  const result: StorageCleanupResult = { status: "completed", dryRun, checkedCount: 0, candidateCount: 0, deletedCount: 0, skippedCount: 0, failureCount: 0 };
  const cutoff = now.getTime() - MIN_OBJECT_AGE_MS;
  if (!Number.isFinite(cutoff)) {
    throw new Error("Invalid storage cleanup time.");
  }
  log("info", "storage cleanup started", { provider: adapter.provider, dryRun, cutoff: new Date(cutoff).toISOString() });

  // 잠금 획득부터 해제까지 동일한 DB 연결을 사용한다.
  return db.transaction(async (tx) => {
    const lock = await tx.execute(sql`SELECT pg_try_advisory_xact_lock(${STORAGE_CLEANUP_LOCK_KEY}) AS locked`);
    if (!(lock as unknown as Array<{ locked: boolean }>)[0]?.locked) {
      result.status = "skipped";
      log("info", "storage cleanup skipped", { reason: "batch lock is already held" });
      return result;
    }

    // 참조 조회 실패 시 저장소 삭제를 시작하지 않는다.
    const referencedKeys = await getReferencedStorageKeys(tx);
    for await (const object of adapter.list()) {
      result.checkedCount += 1;
      if (!Number.isFinite(object.lastModified.getTime()) || object.lastModified.getTime() > cutoff || referencedKeys.has(object.storageKey)) {
        result.skippedCount += 1;
        continue;
      }

      // 최초 조회 이후 새로 연결된 파일도 보존한다. DB 오류는 배치 전체를 중단한다.
      if (await isStorageKeyReferenced(tx, object.storageKey)) {
        result.skippedCount += 1;
        continue;
      }
      result.candidateCount += 1;
      const details = { storageKey: object.storageKey, versionId: object.versionId, size: object.size };
      if (dryRun) {
        log("info", "storage cleanup candidate", details);
        continue;
      }
      try {
        if (await adapter.deleteIfUnchanged(object)) {
          result.deletedCount += 1;
          log("info", "storage object deleted", details);
        } else {
          result.skippedCount += 1;
          log("info", "storage object changed or missing", details);
        }
      } catch (error) {
        result.failureCount += 1;
        log("error", "storage object deletion failed", { ...details, error: error instanceof Error ? error.message : String(error) });
      }
    }
    log("info", "storage cleanup completed", result);
    return result;
  });
}

async function getReferencedStorageKeys(tx: CleanupTransaction) {
  const keys = new Set<string>();
  const media = await tx.select({ storageKey: postMedia.storageKey, url: postMedia.url, thumbnailUrl: postMedia.thumbnailUrl })
    .from(postMedia).innerJoin(workoutPosts, eq(postMedia.postId, workoutPosts.id)).where(isNull(workoutPosts.deletedAt));
  for (const row of media) {
    keys.add(row.storageKey);
    addUploadUrl(keys, row.url);
    addUploadUrl(keys, row.thumbnailUrl);
  }
  const records = await tx.select({ storageKey: bankBalanceRecords.imageStorageKey, url: bankBalanceRecords.imageUrl })
    .from(bankBalanceRecords).where(isNull(bankBalanceRecords.deletedAt));
  for (const row of records) {
    keys.add(row.storageKey);
    addUploadUrl(keys, row.url);
  }
  const avatars = await tx.select({ storageKey: users.avatarStorageKey }).from(users).where(isNull(users.deletedAt));
  for (const row of avatars) {
    if (row.storageKey) {
      keys.add(row.storageKey);
    }
  }
  return keys;
}

function addUploadUrl(keys: Set<string>, value: string | null) {
  if (!value) {
    return;
  }
  const url = new URL(value, "https://storage.invalid");
  if (url.pathname.startsWith("/uploads/")) {
    const key = url.pathname.slice("/uploads/".length);
    keys.add(key);
    keys.add(decodeURIComponent(key));
  }
}

async function isStorageKeyReferenced(tx: CleanupTransaction, storageKey: string) {
  const paths = [`/uploads/${storageKey}`, `/uploads/${storageKey.split("/").map(encodeURIComponent).join("/")}`];
  const origin = process.env.OUNWAN_APP_ORIGIN?.trim();
  const urls = origin ? [...paths, ...paths.map((path) => new URL(path, origin).href)] : paths;
  const media = await tx.select({ id: postMedia.id }).from(postMedia)
    .innerJoin(workoutPosts, eq(postMedia.postId, workoutPosts.id))
    .where(and(isNull(workoutPosts.deletedAt), or(eq(postMedia.storageKey, storageKey), inArray(postMedia.url, urls), inArray(postMedia.thumbnailUrl, urls)))).limit(1);
  if (media.length) {
    return true;
  }
  const records = await tx.select({ id: bankBalanceRecords.id }).from(bankBalanceRecords)
    .where(and(isNull(bankBalanceRecords.deletedAt), or(eq(bankBalanceRecords.imageStorageKey, storageKey), inArray(bankBalanceRecords.imageUrl, urls)))).limit(1);
  if (records.length) {
    return true;
  }
  const avatars = await tx.select({ id: users.id }).from(users)
    .where(and(isNull(users.deletedAt), eq(users.avatarStorageKey, storageKey))).limit(1);
  return avatars.length > 0;
}

function log(level: "info" | "error", message: string, data: object = {}) {
  const entry = JSON.stringify({ level, batch: "storage-cleanup", message, ...data });
  if (level === "error") {
    console.error(entry);
  } else {
    console.log(entry);
  }
}
