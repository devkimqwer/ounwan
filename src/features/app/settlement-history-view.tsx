import { useState } from "react";

import { AppDialog } from "@/components/ui/app-dialog";
import type { SettlementSummary } from "@/domain/models";
import { formatSystemDateTime, formatSystemMonthDay } from "@/lib/date-format";

export function SettlementHistoryView({ settlements, onBack }: { settlements: SettlementSummary[]; onBack: () => void }) {
  const [selectedSettlement, setSelectedSettlement] = useState<SettlementSummary | null>(null);

  return (
    <div className="min-h-full bg-slate-50">
      <div className="sticky top-0 z-10 flex h-14 items-center justify-center border-b border-slate-200 bg-white px-4">
        <button
          type="button"
          className="absolute left-2 grid h-10 w-10 place-items-center rounded-full text-slate-700 transition-colors active:bg-slate-100"
          aria-label="뒤로가기"
          onClick={onBack}
        >
          <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-base font-extrabold text-slate-950">결산 내역</h1>
      </div>

      <div className="space-y-3 p-4">
        {settlements.length > 0 ? (
          settlements.map((settlement) => (
            <button
              key={settlement.id}
              type="button"
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm shadow-slate-200/40 transition-colors active:bg-slate-50"
              onClick={() => setSelectedSettlement(settlement)}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-700">
                <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 2v4" />
                  <path d="M16 2v4" />
                  <rect width="18" height="18" x="3" y="4" rx="2" />
                  <path d="M3 10h18" />
                  <path d="M8 14h.01" />
                  <path d="M12 14h.01" />
                  <path d="M16 14h.01" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-extrabold leading-5 text-slate-950">
                  {formatSettlementRange(settlement.weekStartDate, settlement.weekEndDate)}
                </span>
                <span className="mt-1 block truncate text-xs font-semibold text-slate-500">{settlement.seasonName} 주간 결산</span>
                <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-slate-400">
                  <span>{settlement.participantCount}명</span>
                  <span>{settlement.finalFineAmountTotal.toLocaleString("ko-KR")}원</span>
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
              <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2v4" />
                <path d="M16 2v4" />
                <rect width="18" height="18" x="3" y="4" rx="2" />
                <path d="M3 10h18" />
              </svg>
            </span>
            <h2 className="mt-4 text-base font-extrabold text-slate-950">결산 내역이 없습니다.</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">주간 결산이 생성되면 이곳에 표시됩니다.</p>
          </section>
        )}
      </div>

      <AppDialog
        open={Boolean(selectedSettlement)}
        title="결산 상세"
        description={selectedSettlement ? getSettlementDescription(selectedSettlement) : ""}
        onClose={() => setSelectedSettlement(null)}
        dismissOnBackdrop
        actions={[{ label: "확인", onClick: () => setSelectedSettlement(null) }]}
      />
    </div>
  );
}

function SettlementStatusBadge({ status }: { status: SettlementSummary["status"] }) {
  if (status === "confirmed") {
    return <span className="shrink-0 rounded-full bg-[#1db9a6] px-3 py-1.5 text-xs font-extrabold leading-none text-white">확정</span>;
  }

  return <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-extrabold leading-none text-amber-700">미확정</span>;
}

function formatSettlementRange(startDate: string, endDate: string) {
  return `${formatSystemMonthDay(startDate)} ~ ${formatSystemMonthDay(endDate)}`;
}

function getSettlementDescription(settlement: SettlementSummary) {
  const confirmedText = settlement.confirmedAt ? `확정일: ${formatSystemDateTime(settlement.confirmedAt)}` : "아직 확정되지 않았습니다.";
  return `${formatSettlementRange(settlement.weekStartDate, settlement.weekEndDate)} · ${settlement.finalFineAmountTotal.toLocaleString("ko-KR")}원 · ${confirmedText}`;
}
