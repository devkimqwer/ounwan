import type { ReactNode } from "react";

import type { SettlementRow, SettlementSummary, User } from "@/domain/models";
import { formatSystemDateTime, formatSystemMonthDay } from "@/lib/date-format";
import { Avatar, getUserById } from "./shared-ui";

export function SettlementHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
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

export function SettlementParticipantTable({
  days,
  rows,
  users,
  currentUserId,
  renderFinalFine,
}: {
  days: string[];
  rows: SettlementRow[];
  users: User[];
  currentUserId?: string;
  renderFinalFine?: (row: SettlementRow) => ReactNode;
}) {
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
            const isCurrentUser = row.userId === currentUserId;

            return (
              <tr key={row.userId} className={`border-b border-slate-100 last:border-b-0 ${isCurrentUser ? "bg-[#F7F5FF]" : ""}`}>
                <td className={`sticky left-0 z-[1] min-w-32 px-4 py-3 ${isCurrentUser ? "bg-[#F7F5FF]" : "bg-white"}`}>
                  <div className="flex items-center gap-2">
                    <Avatar name={displayUser.name} imageUrl={displayUser.avatarUrl} size="sm" />
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <p className="truncate text-sm font-bold text-slate-950">{displayUser.name}</p>
                        {isCurrentUser && <span className="shrink-0 rounded-full bg-[#5e4ea5] px-1 py-1 text-[10px] font-extrabold leading-none text-white">나</span>}
                      </div>
                      <p className="text-[11px] font-normal text-slate-400">인증 {row.validWorkoutCount}회</p>
                    </div>
                  </div>
                  {row.memo && <p className="mt-2 rounded-lg bg-slate-50 px-2 py-1.5 text-[11px] font-semibold leading-4 text-slate-500">{row.memo}</p>}
                </td>
                {days.map((day) => (
                  <td key={day} className="px-2 py-3 text-center">
                    <DailyWorkoutMark count={row.dailyResults[day]?.count ?? 0} />
                  </td>
                ))}
                <td className={`px-2 py-3 text-center text-sm font-bold ${row.missedCount > 0 ? "text-red-500" : "text-slate-400"}`}>
                  {row.missedCount}
                </td>
                <td className="px-3 py-3 text-right">
                  {renderFinalFine ? (
                    renderFinalFine(row)
                  ) : (
                    <>
                      <p className={`text-sm font-bold ${row.finalFineAmount > 0 ? "text-red-500" : "text-slate-500"}`}>{formatCurrency(row.finalFineAmount)}</p>
                      {adjustmentAmount !== 0 && <p className="mt-0.5 text-[11px] font-normal text-slate-400">조정 {formatSignedCurrency(adjustmentAmount)}</p>}
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
export function DailyWorkoutMark({ count }: { count: number }) {
  if (count <= 0) {
    return <span className="inline-grid h-6 w-6 place-items-center rounded-full text-xs font-bold text-slate-300">-</span>;
  }

  if (count === 1) {
    return <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-[#F2F0FA] text-sm font-extrabold text-[#5e4ea5]">✓</span>;
  }

  return <span className="inline-grid h-6 min-w-6 place-items-center rounded-full bg-[#F2F0FA] px-1.5 text-xs font-extrabold text-[#5e4ea5]">{count}</span>;
}

export function SettlementMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-3">
      <p className="text-xs font-bold text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-950">{value}</p>
    </div>
  );
}

export function SettlementTotalCell({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="border-r border-slate-100 px-3 py-4 text-center last:border-r-0">
      <p className="text-[11px] font-bold text-slate-400">{label}</p>
      <p className={`mt-1 text-sm ${strong ? "font-extrabold text-slate-950" : "font-medium text-slate-600"}`}>{value}</p>
    </div>
  );
}

export function SettlementStatusBadge({ status }: { status: SettlementSummary["status"] }) {
  if (status === "confirmed") {
    return <span className="shrink-0 rounded-full bg-[#5e4ea5] px-3 py-1.5 text-xs font-extrabold leading-none text-white">확정</span>;
  }

  return <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-extrabold leading-none text-amber-700">미확정</span>;
}

export function CalendarIcon({ className = "h-5 w-5" }: { className?: string }) {
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

export function formatSettlementRange(startDate: string, endDate: string) {
  return `${formatSystemMonthDay(startDate)} ~ ${formatSystemMonthDay(endDate)}`;
}

export function formatCurrency(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

export function formatSignedCurrency(value: number) {
  if (value === 0) {
    return "0원";
  }

  return `${value > 0 ? "+" : "-"}${formatCurrency(Math.abs(value))}`;
}

export function formatSettlementDateTime(value: string) {
  return formatSystemDateTime(value);
}

function getWeekdayLabel(date: string) {
  const weekday = new Date(`${date}T00:00:00`).getDay();
  return ["일", "월", "화", "수", "목", "금", "토"][weekday];
}