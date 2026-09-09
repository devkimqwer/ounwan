function parseDateValue(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatDateParts(year: number, month: number, day: number) {
  return `${year}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
}

export function formatSystemDate(value: string | Date) {
  if (typeof value === "string") {
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (dateOnlyMatch) {
      return `${dateOnlyMatch[1]}.${dateOnlyMatch[2]}.${dateOnlyMatch[3]}`;
    }
  }

  const date = parseDateValue(value);
  if (!date) {
    return typeof value === "string" ? value : "";
  }

  return formatDateParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function formatSystemMonthDay(value: string | Date) {
  if (typeof value === "string") {
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (dateOnlyMatch) {
      return `${dateOnlyMatch[2]}.${dateOnlyMatch[3]}`;
    }
  }

  const date = parseDateValue(value);
  if (!date) {
    return typeof value === "string" ? value : "";
  }

  return `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}
export function formatSystemDateTime(value: string | Date) {
  const date = parseDateValue(value);
  if (!date) {
    return typeof value === "string" ? value : "";
  }

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${formatSystemDate(date)} ${hours}:${minutes}:${seconds}`;
}