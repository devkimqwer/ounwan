export const weekdays = [
  { value: 0, label: "월요일" },
  { value: 1, label: "화요일" },
  { value: 2, label: "수요일" },
  { value: 3, label: "목요일" },
  { value: 4, label: "금요일" },
  { value: 5, label: "토요일" },
  { value: 6, label: "일요일" },
];

export function formatWeekday(value: number) {
  return weekdays.find((weekday) => weekday.value === value)?.label ?? "월요일";
}