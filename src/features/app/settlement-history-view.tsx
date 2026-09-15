import { useEffect, useRef, useState } from "react";

import { getSettlementDetailAction } from "@/app/actions";
import type { SettlementDetail, SettlementSummary, User } from "@/domain/models";
import { SettlementAdminDetailView } from "./settlement-admin-detail-view";
import { SettlementDetailView } from "./settlement-detail-view";
import { CalendarIcon, formatCurrency, formatSettlementRange, SettlementHeader, SettlementStatusBadge } from "./settlement-detail-ui";

type SettlementHistoryMode = "user" | "admin";

export function SettlementHistoryView({
  settlements,
  users,
  currentUserId,
  mode = "user",
  initialSettlementId,
  onInitialSettlementHandled,
  onSettlementViewed,
  onBack,
}: {
  settlements: SettlementSummary[];
  users: User[];
  currentUserId: string;
  mode?: SettlementHistoryMode;
  initialSettlementId?: string | null;
  onInitialSettlementHandled?: () => void;
  onSettlementViewed?: (settlementId: string) => void;
  onBack: () => void;
}) {
  const [selectedSettlement, setSelectedSettlement] = useState<SettlementDetail | null>(null);
  const [loadingSettlementId, setLoadingSettlementId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState("");
  const settlementDetailHistoryActiveRef = useRef(false);
  const selectedSettlementIdRef = useRef<string | null>(null);
  const modeRef = useRef(mode);
  const morePageName = mode === "admin" ? "settlement-management" : "settlement-history";

  useEffect(() => {
    selectedSettlementIdRef.current = selectedSettlement?.id ?? null;
  }, [selectedSettlement?.id]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const settlementDetailId = event.state?.ounwanSettlementDetail as string | undefined;
      if (settlementDetailId) {
        settlementDetailHistoryActiveRef.current = true;
        if (selectedSettlementIdRef.current !== settlementDetailId) {
          void loadSettlementDetail(settlementDetailId, { pushHistory: false });
        }
        return;
      }

      if (settlementDetailHistoryActiveRef.current || selectedSettlementIdRef.current) {
        settlementDetailHistoryActiveRef.current = false;
        selectedSettlementIdRef.current = null;
        setSelectedSettlement(null);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const loadSettlementDetail = async (settlementId: string, { pushHistory }: { pushHistory: boolean }) => {
    if (loadingSettlementId) {
      return;
    }

    setDetailError("");
    setLoadingSettlementId(settlementId);

    try {
      const detail = await getSettlementDetailAction(settlementId);
      if (!detail) {
        setDetailError("결산 내역을 찾을 수 없습니다.");
        return;
      }

      if (pushHistory) {
        settlementDetailHistoryActiveRef.current = true;
        window.history.replaceState({ ounwanMorePage: morePageName }, "");
        window.history.pushState({ ounwanMorePage: morePageName, ounwanSettlementDetail: settlementId }, "");
      }

      selectedSettlementIdRef.current = detail.id;
      onSettlementViewed?.(detail.id);
      setSelectedSettlement(detail);
    } catch {
      setDetailError("결산 내역을 불러올 수 없습니다.");
    } finally {
      setLoadingSettlementId(null);
    }
  };

  const openSettlementDetail = (settlementId: string) => {
    void loadSettlementDetail(settlementId, { pushHistory: true });
  };

  useEffect(() => {
    if (!initialSettlementId || selectedSettlementIdRef.current === initialSettlementId) {
      return;
    }

    onInitialSettlementHandled?.();
    void loadSettlementDetail(initialSettlementId, { pushHistory: true });
  }, [initialSettlementId, onInitialSettlementHandled]);

  const reloadSelectedSettlement = () => {
    const settlementId = selectedSettlementIdRef.current;
    if (settlementId) {
      void loadSettlementDetail(settlementId, { pushHistory: false });
    }
  };

  const closeSettlementDetail = () => {
    if (settlementDetailHistoryActiveRef.current) {
      settlementDetailHistoryActiveRef.current = false;
      window.history.back();
      return;
    }

    selectedSettlementIdRef.current = null;
    setSelectedSettlement(null);
  };

  if (selectedSettlement) {
    if (modeRef.current === "admin") {
      return <SettlementAdminDetailView settlement={selectedSettlement} users={users} currentUserId={currentUserId} onBack={closeSettlementDetail} onChanged={reloadSelectedSettlement} />;
    }

    return <SettlementDetailView settlement={selectedSettlement} users={users} currentUserId={currentUserId} onBack={closeSettlementDetail} />;
  }

  return (
    <div className="min-h-full bg-slate-50">
      <SettlementHeader title={mode === "admin" ? "결산 관리" : "결산 내역"} onBack={onBack} />

      <div className="space-y-3 p-4">
        {detailError && (
          <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{detailError}</p>
        )}

        {settlements.length > 0 ? (
          settlements.map((settlement) => (
            <button
              key={settlement.id}
              type="button"
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm shadow-slate-200/40 transition-colors active:bg-slate-50 disabled:cursor-wait disabled:opacity-70"
              onClick={() => openSettlementDetail(settlement.id)}
              disabled={loadingSettlementId === settlement.id}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-700">
                <CalendarIcon />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-extrabold leading-5 text-slate-950">
                  {formatSettlementRange(settlement.weekStartDate, settlement.weekEndDate)}
                </span>
                <span className="mt-1 block truncate text-xs font-semibold text-slate-500">{settlement.seasonName} 주간 결산</span>
                <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-slate-400">
                  <span>{settlement.participantCount}명</span>
                  <span>{formatCurrency(settlement.finalFineAmountTotal)}</span>
                </span>
              </span>
              <SettlementStatusBadge status={settlement.status} />
              <svg aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          ))
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#F2F0FA] text-[#5e4ea5]">
              <CalendarIcon className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-base font-extrabold text-slate-950">결산 내역이 없습니다.</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">주간 결산이 생성되면 이곳에 표시됩니다.</p>
          </section>
        )}
      </div>
    </div>
  );
}
