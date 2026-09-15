import { type ReactNode, useEffect, useRef, useState } from "react";

import { getSettlementDetailAction } from "@/app/actions";
import type { SettlementDetail, SettlementRow, SettlementSummary, User } from "@/domain/models";
import { formatSystemDateTime, formatSystemMonthDay } from "@/lib/date-format";
import { Avatar, getUserById } from "./shared-ui";

export function SettlementHistoryView({ settlements, users, onBack }: { settlements: SettlementSummary[]; users: User[]; onBack: () => void }) {
  const [selectedSettlement, setSelectedSettlement] = useState<SettlementDetail | null>(null);
  const [loadingSettlementId, setLoadingSettlementId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState("");
  const settlementDetailHistoryActiveRef = useRef(false);
  const selectedSettlementIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedSettlementIdRef.current = selectedSettlement?.id ?? null;
  }, [selectedSettlement?.id]);

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
        window.history.replaceState({ ounwanMorePage: "settlement-history" }, "");
        window.history.pushState({ ounwanMorePage: "settlement-history", ounwanSettlementDetail: settlementId }, "");
      }

      selectedSettlementIdRef.current = detail.id;
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
    return <SettlementDetailView settlement={selectedSettlement} users={users} onBack={closeSettlementDetail} />;
  }

  return (
    <div className="min-h-full bg-slate-50">
      <SettlementHeader title="결산 내역" onBack={onBack} />

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

function SettlementDetailView({ settlement, users, onBack }: { settlement: SettlementDetail; users: User[]; onBack: () => void }) {
  const rows = [...settlement.rows].sort((a, b) => b.finalFineAmount - a.finalFineAmount || b.missedCount - a.missedCount || a.userId.localeCompare(b.userId));
  const confirmedText = settlement.confirmedAt ? formatSystemDateTime(settlement.confirmedAt) : undefined;

  return (
    <div className="min-h-full bg-slate-50 pb-6">
      <SettlementHeader title="결산 상세" onBack={onBack} right={<SettlementStatusBadge status={settlement.status} />} />

      <div className="space-y-4 p-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-400">{settlement.seasonName}</p>
              <h2 className="mt-1 text-xl font-extrabold text-slate-950">{formatSettlementRange(settlement.weekStartDate, settlement.weekEndDate)}</h2>
            </div>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#F2F0FA] text-[#5e4ea5]">
              <CalendarIcon />
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <SettlementMetric label="참가자" value={`${settlement.participantCount}명`} />
            <SettlementMetric label="최종 벌금" value={formatCurrency(settlement.finalFineAmountTotal)} />
            <SettlementMetric label="목표" value={`주 ${settlement.targetWorkoutCountPerWeek}회`} />
            <SettlementMetric label="회당 벌금" value={formatCurrency(settlement.finePerMiss)} />
          </div>

          {confirmedText && <p className="mt-3 text-xs font-semibold text-slate-400">확정일: {confirmedText}</p>}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-extrabold text-slate-950">이번 주 결산 코멘트</h3>
          <p className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-600">
            {settlement.comment?.trim() || "등록된 코멘트가 없습니다."}
          </p>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-extrabold text-slate-950">참가자별 결산</h3>
            <span className="text-xs font-bold text-slate-400">총 {rows.length}명</span>
          </div>

          {rows.length > 0 ? (
            <SettlementParticipantTable days={settlement.days} rows={rows} users={users} />
          ) : (
            <p className="px-4 py-8 text-center text-sm font-semibold text-slate-500">결산 대상자가 없습니다.</p>
          )}
        </section>

        <section className="grid grid-cols-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <SettlementTotalCell label="자동 산출" value={formatCurrency(settlement.autoFineAmountTotal)} />
          <SettlementTotalCell label="조정 금액" value={formatSignedCurrency(settlement.adjustmentAmountTotal)} />
          <SettlementTotalCell label="최종 벌금" value={formatCurrency(settlement.finalFineAmountTotal)} strong />
        </section>
      </div>
    </div>
  );
}

function SettlementHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  return (
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
      <h1 className="text-base font-extrabold text-slate-950">{title}</h1>
      {right && <div className="absolute right-4">{right}</div>}
    </div>
  );
}

function SettlementParticipantTable({ days, rows, users }: { days: string[]; rows: SettlementRow[]; users: User[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-extrabold text-slate-400">
            <th className="sticky left-0 z-[1] min-w-32 bg-slate-50 px-4 py-3 text-left">이름</th>
            {days.map((day) => (
              <th key={day} className="min-w-12 px-2 py-3 text-center">
                <span className="block text-slate-600">{formatSystemMonthDay(day)}</span>
                <span className="mt-0.5 block">({getWeekdayLabel(day)})</span>
              </th>
            ))}
            <th className="min-w-12 px-2 py-3 text-center">누락</th>
            <th className="min-w-20 px-3 py-3 text-right">벌금</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const user = getUserById(users, row.userId);
            const displayUser = user ?? { name: "알 수 없는 사용자", avatarUrl: undefined };
            const adjustmentAmount = row.finalFineAmount - row.autoFineAmount;

            return (
              <tr key={row.userId} className="border-b border-slate-100 last:border-b-0">
                <td className="sticky left-0 z-[1] min-w-32 bg-white px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Avatar name={displayUser.name} imageUrl={displayUser.avatarUrl} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-slate-950">{displayUser.name}</p>
                      <p className="text-[11px] font-semibold text-slate-400">인증 {row.validWorkoutCount}회</p>
                    </div>
                  </div>
                  {row.memo && <p className="mt-2 rounded-lg bg-slate-50 px-2 py-1.5 text-[11px] font-semibold leading-4 text-slate-500">{row.memo}</p>}
                </td>
                {days.map((day) => (
                  <td key={day} className="px-2 py-3 text-center">
                    <DailyWorkoutMark count={row.dailyResults[day]?.count ?? 0} />
                  </td>
                ))}
                <td className={`px-2 py-3 text-center text-sm font-extrabold ${row.missedCount > 0 ? "text-red-500" : "text-slate-400"}`}>
                  {row.missedCount}
                </td>
                <td className="px-3 py-3 text-right">
                  <p className={`text-sm font-extrabold ${row.finalFineAmount > 0 ? "text-red-500" : "text-slate-500"}`}>{formatCurrency(row.finalFineAmount)}</p>
                  {adjustmentAmount !== 0 && <p className="mt-0.5 text-[11px] font-bold text-slate-400">조정 {formatSignedCurrency(adjustmentAmount)}</p>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DailyWorkoutMark({ count }: { count: number }) {
  if (count <= 0) {
    return <span className="inline-grid h-6 w-6 place-items-center rounded-full text-xs font-bold text-slate-300">-</span>;
  }

  if (count === 1) {
    return <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-teal-50 text-sm font-extrabold text-[#1db9a6]">✓</span>;
  }

  return <span className="inline-grid h-6 min-w-6 place-items-center rounded-full bg-teal-50 px-1.5 text-xs font-extrabold text-[#1db9a6]">{count}</span>;
}

function SettlementMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-3">
      <p className="text-xs font-bold text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-extrabold text-slate-950">{value}</p>
    </div>
  );
}

function SettlementTotalCell({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="border-r border-slate-100 px-3 py-4 text-center last:border-r-0">
      <p className="text-[11px] font-bold text-slate-400">{label}</p>
      <p className={`mt-1 text-sm ${strong ? "font-extrabold text-slate-950" : "font-bold text-slate-600"}`}>{value}</p>
    </div>
  );
}

function SettlementStatusBadge({ status }: { status: SettlementSummary["status"] }) {
  if (status === "confirmed") {
    return <span className="shrink-0 rounded-full bg-[#1db9a6] px-3 py-1.5 text-xs font-extrabold leading-none text-white">확정</span>;
  }

  return <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-extrabold leading-none text-amber-700">미확정</span>;
}

function CalendarIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 14h.01" />
      <path d="M12 14h.01" />
      <path d="M16 14h.01" />
    </svg>
  );
}

function formatSettlementRange(startDate: string, endDate: string) {
  return `${formatSystemMonthDay(startDate)} ~ ${formatSystemMonthDay(endDate)}`;
}

function formatCurrency(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function formatSignedCurrency(value: number) {
  if (value === 0) {
    return "0원";
  }

  return `${value > 0 ? "+" : "-"}${formatCurrency(Math.abs(value))}`;
}

function getWeekdayLabel(date: string) {
  const weekday = new Date(`${date}T00:00:00`).getDay();
  return ["일", "월", "화", "수", "목", "금", "토"][weekday];
}
