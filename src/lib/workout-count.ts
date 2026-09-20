import type { DailyDuplicatePolicy, SettlementDailyResults } from "../domain/models";
import { getKoreanWorkoutDate } from "./season-time";

export function calculateDailyWorkouts(
  posts: Array<{ id: string | bigint; createdAt: Date }>,
  rules: { dayStartTime: string; dailyDuplicatePolicy: DailyDuplicatePolicy },
  period: { weekStartDate: string; weekEndDate: string },
) {
  const dailyResults: SettlementDailyResults = {};
  const cursor = new Date(`${period.weekStartDate}T00:00:00Z`);
  const end = new Date(`${period.weekEndDate}T00:00:00Z`);

  while (cursor <= end) {
    dailyResults[cursor.toISOString().slice(0, 10)] = { count: 0, countedPostIds: [] };
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  for (const post of posts) {
    const day = getKoreanWorkoutDate(post.createdAt, rules.dayStartTime);
    const result = dailyResults[day];
    if (!result || (rules.dailyDuplicatePolicy === "count_once" && result.count > 0)) {
      continue;
    }

    result.count += 1;
    result.countedPostIds.push(post.id.toString());
  }

  return {
    dailyResults,
    validWorkoutCount: Object.values(dailyResults).reduce((sum, result) => sum + result.count, 0),
  };
}
