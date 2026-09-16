import { AppSubPageHeader } from "./shared-ui";
import type { SettlementDetail, User } from "@/domain/models";
import {
  CalendarIcon,
  formatCurrency,
  formatSettlementDateTime,
  formatSettlementRange,
  formatSignedCurrency,
  SettlementMetric,
  SettlementParticipantTable,
  SettlementStatusBadge,
  SettlementTotalCell,
} from "./settlement-detail-ui";

export function SettlementDetailView({ settlement, users, currentUserId, onBack }: { settlement: SettlementDetail; users: User[]; currentUserId: string; onBack: () => void }) {
  const rows = [...settlement.rows].sort((a, b) => b.finalFineAmount - a.finalFineAmount || b.missedCount - a.missedCount || a.userId.localeCompare(b.userId));
  const confirmedText = settlement.confirmedAt ? formatSettlementDateTime(settlement.confirmedAt) : undefined;

  return (
    <div className="min-h-full bg-slate-50 pb-6">
      <AppSubPageHeader title="결산 상세" onBack={onBack} right={<SettlementStatusBadge status={settlement.status} />} />

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
          <p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-600">
            {settlement.comment?.trim() || "등록된 코멘트가 없습니다."}
          </p>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-extrabold text-slate-950">참가자별 결산</h3>
            <span className="text-xs font-bold text-slate-400">총 {rows.length}명</span>
          </div>

          {rows.length > 0 ? (
            <SettlementParticipantTable days={settlement.days} rows={rows} users={users} currentUserId={currentUserId} />
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