import { closeDatabase } from "../db/database";
import { runWeeklySettlementBatch } from "../db/weekly-settlement";

async function main() {
  const result = await runWeeklySettlementBatch();

  if (result.failureCount > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ level: "error", batch: "weekly-settlement", message: "fatal failure", error: serializeError(error) }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }

  return { message: String(error) };
}
