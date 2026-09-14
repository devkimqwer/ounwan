import { isInitialTabId, type InitialTabId } from "./app-types";

const INITIAL_TAB_STORAGE_PREFIX = "ounwan.initial-tab";

export const DEFAULT_INITIAL_TAB_ID: InitialTabId = "home";

function getInitialTabStorageKey(userId: string) {
  return `${INITIAL_TAB_STORAGE_PREFIX}:${userId}`;
}

export function readInitialTabPreference(userId: string): InitialTabId {
  if (typeof window === "undefined") {
    return DEFAULT_INITIAL_TAB_ID;
  }

  try {
    const storedTabId = window.localStorage.getItem(getInitialTabStorageKey(userId));
    return isInitialTabId(storedTabId) ? storedTabId : DEFAULT_INITIAL_TAB_ID;
  } catch {
    return DEFAULT_INITIAL_TAB_ID;
  }
}

export function writeInitialTabPreference(userId: string, tabId: InitialTabId) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(getInitialTabStorageKey(userId), tabId);
  } catch {
    // 저장소 접근 실패는 기본 첫 화면으로 동작하게 둔다.
  }
}