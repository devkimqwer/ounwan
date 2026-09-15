import { type FormEvent, useMemo, useState } from "react";

import { confirmWeeklySettlementAction, type ConfirmWeeklySettlementState } from "@/app/actions";
import { AppDialog } from "@/components/ui/app-dialog";
import type { SettlementDetail, SettlementRow, User } from "@/domain/models";
import {
  CalendarIcon,
  formatCurrency,
  formatSettlementDateTime,
  formatSettlementRange,
  formatSignedCurrency,
  SettlementHeader,
  SettlementMetric,
  SettlementParticipantTable,
  SettlementStatusBadge,
  SettlementTotalCell,
} from "./settlement-detail-ui";

const MAX_SETTLEMENT_COMMENT_LENGTH = 300;
const settlementInitialState: ConfirmWeeklySettlementState = { status: "idle", message: "" };

export function SettlementAdminDetailView({
  settlement,
  users,
  currentUserId,
  onBack,
  onChanged,
}: {
  settlement: SettlementDetail;
  users: User[];
  currentUserId: string;
  onBack: () => void;
  onChanged: () => void;
}) {
  const sortedRows = useMemo(
    () => [...settlement.rows].sort((a, b) => b.finalFineAmount - a.finalFineAmount || b.missedCount - a.missedCount || a.userId.localeCompare(b.userId)),
    [settlement.rows],
  );
  const [comment, setComment] = useState(settlement.comment ?? "");
  const [finalFineAmounts, setFinalFineAmounts] = useState(() => Object.fromEntries(settlement.rows.map((row) => [row.userId, String(row.finalFineAmount)])));
  const [state, setState] = useState<ConfirmWeeklySettlementState>(settlementInitialState);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isDraft = settlement.status === "draft";
  const confirmedText = settlement.confirmedAt ? formatSettlementDateTime(settlement.confirmedAt) : undefined;
  const currentFinalTotal = sortedRows.reduce((total, row) => total + parseFineAmount(finalFineAmounts[row.userId]), 0);
  const currentAdjustmentTotal = currentFinalTotal - settlement.autoFineAmountTotal;

  const validateForm = () => {
    if (comment.length > MAX_SETTLEMENT_COMMENT_LENGTH) {
      return "코멘트는 300자 이내로 입력해주세요.";
    }

    for (const row of settlement.rows) {
      const amountText = finalFineAmounts[row.userId] ?? "";
      if (!/^\d+$/.test(amountText)) {
        return "총 벌금은 0 이상의 숫자만 입력해주세요.";
      }
    }

    return "";
  };

  const requestConfirm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || !isDraft) {
      return;
    }

    const errorMessage = validateForm();
    if (errorMessage) {
      setState({ status: "error", message: errorMessage });
      return;
    }

    setState(settlementInitialState);
    setConfirmDialogOpen(true);
  };

  const submitConfirmation = async () => {
    if (submitting) {
      return;
    }

    const formData = new FormData();
    formData.set("settlementId", settlement.id);
    formData.set("comment", comment.trim());
    for (const row of settlement.rows) {
      formData.set(`finalFineAmount:${row.userId}`, finalFineAmounts[row.userId] ?? String(row.finalFineAmount));
    }

    setSubmitting(true);
    setState(settlementInitialState);

    try {
      const result = await confirmWeeklySettlementAction(formData);
      setState(result);
      if (result.status === "success") {
        setConfirmDialogOpen(false);
        onChanged();
      }
    } catch {
      setState({ status: "error", message: "결산을 확정할 수 없습니다." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-50 pb-6">
      <SettlementHeader title="결산 관리" onBack={onBack} right={<SettlementStatusBadge status={settlement.status} />} />

      <form className="space-y-4 p-4" onSubmit={requestConfirm}>
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
            <SettlementMetric label="최종 벌금" value={formatCurrency(currentFinalTotal)} />
            <SettlementMetric label="목표" value={`주 ${settlement.targetWorkoutCountPerWeek}회`} />
            <SettlementMetric label="회당 벌금" value={formatCurrency(settlement.finePerMiss)} />
          </div>

          {confirmedText && <p className="mt-3 text-xs font-semibold text-slate-400">확정일: {confirmedText}</p>}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-end justify-between gap-3">
            <label className="text-sm font-extrabold text-slate-950" htmlFor="settlement-admin-comment">이번 주 결산 코멘트</label>
            <span className="text-xs font-bold text-slate-400">{comment.length}/{MAX_SETTLEMENT_COMMENT_LENGTH}</span>
          </div>
          {isDraft ? (
            <textarea
              id="settlement-admin-comment"
              name="comment"
              value={comment}
              maxLength={MAX_SETTLEMENT_COMMENT_LENGTH}
              rows={4}
              className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700 break-words outline-none placeholder:text-sm placeholder:text-slate-400 focus:border-[#5e4ea5]"
              placeholder="이번 주 결산에 대한 코멘트를 남겨주세요. (선택사항)"
              onChange={(event) => setComment(event.target.value)}
            />
          ) : (
            <p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-sm font-normal leading-6 text-slate-600">
              {settlement.comment?.trim() || "등록된 코멘트가 없습니다."}
            </p>
          )}
          {isDraft && <p className="mt-2 text-xs font-semibold text-slate-400">결산 확정 후에는 수정할 수 없습니다.</p>}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-extrabold text-slate-950">참가자별 결산</h3>
            <span className="text-xs font-bold text-slate-400">총 {sortedRows.length}명</span>
          </div>

          {sortedRows.length > 0 ? (
            <SettlementParticipantTable
              days={settlement.days}
              rows={sortedRows}
              users={users}
              currentUserId={currentUserId}
              renderFinalFine={
                isDraft
                  ? (row) => (
                      <input
                        type="text"
                        inputMode="numeric"
                        name={`finalFineAmount:${row.userId}`}
                        value={finalFineAmounts[row.userId] ?? ""}
                        className="min-h-10 w-20 rounded-xl border border-slate-200 bg-white px-3 text-right text-sm leading-5 text-slate-950 outline-none focus:border-[#5e4ea5]"
                        aria-label={`${row.userId} 사용자 최종 벌금`}
                        onChange={(event) => {
                          const nextValue = event.target.value.replace(/[^0-9]/g, "");
                          setFinalFineAmounts((current) => ({ ...current, [row.userId]: nextValue }));
                        }}
                      />
                    )
                  : undefined
              }
            />
          ) : (
            <p className="px-4 py-8 text-center text-sm font-semibold text-slate-500">결산 대상자가 없습니다.</p>
          )}
        </section>

        <section className="grid grid-cols-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <SettlementTotalCell label="자동 산출" value={formatCurrency(settlement.autoFineAmountTotal)} />
          <SettlementTotalCell label="조정 금액" value={formatSignedCurrency(currentAdjustmentTotal)} />
          <SettlementTotalCell label="최종 벌금" value={formatCurrency(currentFinalTotal)} strong />
        </section>

        {state.message && <p className={`rounded-2xl px-4 py-3 text-sm font-bold ${state.status === "error" ? "border border-red-100 bg-red-50 text-red-600" : "border border-[#DDD8F1] bg-[#F7F5FF] text-[#51438f]"}`}>{state.message}</p>}

        {isDraft ? (
          <button
            type="submit"
            disabled={submitting || sortedRows.length === 0}
            className="min-h-12 w-full rounded-2xl bg-slate-950 px-4 text-base font-extrabold text-white disabled:bg-slate-200 disabled:text-slate-400"
          >
            {submitting ? "처리 중" : "결산 확정"}
          </button>
        ) : (
          <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-bold text-slate-500">확정된 결산은 수정할 수 없습니다.</p>
        )}
      </form>

      <AppDialog
        open={confirmDialogOpen}
        title="결산을 확정하시겠습니까?"
        description="확정 후에는 벌금과 코멘트를 수정할 수 없습니다."
        onClose={() => setConfirmDialogOpen(false)}
        dismissOnBackdrop={!submitting}
        role="alertdialog"
        actions={[
          { label: "취소", onClick: () => setConfirmDialogOpen(false), disabled: submitting },
          { label: submitting ? "처리 중" : "확정", onClick: submitConfirmation, variant: "primary", disabled: submitting, autoFocus: true },
        ]}
      />
    </div>
  );
}

function parseFineAmount(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) {
    return 0;
  }

  return Number(value);
}