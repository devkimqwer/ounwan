const KST_OFFSET = "+09:00";
const DAY_MS = 24 * 60 * 60 * 1000;

export function getKoreanDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function getKoreanWorkoutDate(now = new Date(), dayStartTime = "03:00:00") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const date = new Date(Date.UTC(Number(partMap.year), Number(partMap.month) - 1, Number(partMap.day)));
  const secondOfDay = Number(partMap.hour) * 3600 + Number(partMap.minute) * 60 + Number(partMap.second);

  if (secondOfDay < parseTimeToSecondOfDay(dayStartTime)) {
    date.setUTCDate(date.getUTCDate() - 1);
  }

  return formatUtcDate(date);
}

export function getKoreanWeekRange(date: Date | string = new Date(), weekStartDay = 0) {
  const baseDate = toUtcDate(normalizeDateString(date));
  const dayIndexFromMonday = (baseDate.getUTCDay() + 6) % 7;
  let startOffset = weekStartDay - dayIndexFromMonday;

  if (startOffset > 0) {
    startOffset -= 7;
  }

  baseDate.setUTCDate(baseDate.getUTCDate() + startOffset);

  const endDate = new Date(baseDate);
  endDate.setUTCDate(baseDate.getUTCDate() + 6);

  return {
    weekStartDate: formatUtcDate(baseDate),
    weekEndDate: formatUtcDate(endDate),
  };
}

export function getNextSettlementAt(from: Date, weekStartDay: number, dayStartTime: string) {
  const currentBusinessDate = getKoreanWorkoutDate(from, dayStartTime);
  const currentWeekRange = getKoreanWeekRange(currentBusinessDate, weekStartDay);
  let nextSettlementAt = toKstDateTime(currentWeekRange.weekStartDate, dayStartTime);

  if (nextSettlementAt.getTime() <= from.getTime()) {
    nextSettlementAt = toKstDateTime(addDays(currentWeekRange.weekStartDate, 7), dayStartTime);
  }

  return nextSettlementAt;
}

export function getNextSettlementAtAfter(settlementAt: Date, weekStartDay: number, dayStartTime: string) {
  return getNextSettlementAt(new Date(settlementAt.getTime() + 1000), weekStartDay, dayStartTime);
}

export function getPreviousSettlementPeriod(settlementAt: Date, weekStartDay: number, dayStartTime: string) {
  const currentBusinessDate = getKoreanWorkoutDate(settlementAt, dayStartTime);
  const currentWeekRange = getKoreanWeekRange(currentBusinessDate, weekStartDay);

  return {
    weekStartDate: addDays(currentWeekRange.weekStartDate, -7),
    weekEndDate: addDays(currentWeekRange.weekStartDate, -1),
  };
}

export function getSettlementWindow(weekStartDate: string, dayStartTime: string) {
  return {
    startAt: toKstDateTime(weekStartDate, dayStartTime),
    endAt: toKstDateTime(addDays(weekStartDate, 7), dayStartTime),
  };
}

export function parseTimeToSecondOfDay(value: string) {
  const [hour = "0", minute = "0", second = "0"] = value.split(":");
  return Number(hour) * 3600 + Number(minute) * 60 + Number(second);
}

function normalizeDateString(date: Date | string) {
  return typeof date === "string" ? date.slice(0, 10) : getKoreanDate(date);
}

function toUtcDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toKstDateTime(dateString: string, timeString: string) {
  return new Date(`${dateString}T${normalizeTimeString(timeString)}${KST_OFFSET}`);
}

function normalizeTimeString(value: string) {
  const [hour = "0", minute = "0", second = "0"] = value.split(":");
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:${second.padStart(2, "0")}`;
}

function addDays(dateString: string, days: number) {
  const date = toUtcDate(dateString);
  date.setUTCDate(date.getUTCDate() + days);
  return formatUtcDate(date);
}

function formatUtcDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
