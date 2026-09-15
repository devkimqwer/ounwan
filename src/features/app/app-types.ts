export type TabId = "home" | "feed" | "cert" | "calendar" | "more";
export type MoreSubPage = "main" | "season-management" | "group-member-management" | "bank-account-management" | "balance-status" | "settlement-history" | "settlement-management";

export type InitialTabId = Extract<TabId, "home" | "feed" | "cert" | "calendar">;

export const initialTabOptions: Array<{ id: InitialTabId; label: string }> = [
  { id: "home", label: "홈" },
  { id: "feed", label: "피드" },
  { id: "cert", label: "인증" },
];

export function isInitialTabId(value: string | null): value is InitialTabId {
  return value === "home" || value === "feed" || value === "cert" || value === "calendar";
}