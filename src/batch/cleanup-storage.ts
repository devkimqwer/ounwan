import { closeDatabase } from "../db/database";
import { runStorageCleanupBatch } from "../db/storage-cleanup";

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--dry-run")) {
    throw new Error("Usage: npm run batch:cleanup-storage -- [--dry-run]");
  }
  const result = await runStorageCleanupBatch({ dryRun: args.includes("--dry-run") });
  if (result.failureCount > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(JSON.stringify({
      level: "error",
      batch: "storage-cleanup",
      message: "fatal failure",
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack, cause: String(error.cause ?? "") } : { message: String(error) },
    }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
