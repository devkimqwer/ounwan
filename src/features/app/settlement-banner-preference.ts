const SETTLEMENT_BANNER_STORAGE_KEY_PREFIX = "ounwan:dismissed-settlement-banners";

function getSettlementBannerStorageKey(userId: string, groupId: string) {
    return `${SETTLEMENT_BANNER_STORAGE_KEY_PREFIX}:${userId}:${groupId}`;
}

export function readDismissedSettlementBannerIds(userId: string, groupId: string) {
    try {
        const value = window.localStorage.getItem(getSettlementBannerStorageKey(userId, groupId));
        const parsed = value ? JSON.parse(value) : [];
        return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
        return [];
    }
}

export function writeDismissedSettlementBannerIds(userId: string, groupId: string, settlementIds: string[]) {
    try {
        window.localStorage.setItem(getSettlementBannerStorageKey(userId, groupId), JSON.stringify(settlementIds));
    } catch {
        // localStorage를 사용할 수 없는 환경에서는 현재 세션 상태만 유지한다.
    }
}