import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";

import { activatePendingSeasonAction, closeSeasonAction, deletePendingSeasonAction, updateSeasonRulesAction } from "@/app/actions";
import { AppDialog } from "@/components/ui/app-dialog";
import type { Season, SeasonParticipant } from "@/domain/models";
import { formatSystemDate } from "@/lib/date-format";
import { SeasonCreateForm } from "./season-create-form";
import { Avatar } from "./shared-ui";

type SeasonManagementViewProps = {
  seasons: Season[];
  seasonParticipants: SeasonParticipant[];
  onBack: () => void;
};

type SeasonParticipantMember = {
  seasonId: string;
  user: SeasonParticipant["user"];
  periods: Array<Pick<SeasonParticipant, "id" | "startDate" | "endDate">>;
};

export function SeasonManagementView({ seasons, seasonParticipants, onBack }: SeasonManagementViewProps) {
  const router = useRouter();
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<SeasonParticipantMember | null>(null);
  const [createSeasonDialogOpen, setCreateSeasonDialogOpen] = useState(false);
  const [closeSeasonDialogOpen, setCloseSeasonDialogOpen] = useState(false);
  const [activatePendingSeasonDialogOpen, setActivatePendingSeasonDialogOpen] = useState(false);
  const [deletePendingSeasonDialogOpen, setDeletePendingSeasonDialogOpen] = useState(false);
  const [seasonRulesDialogOpen, setSeasonRulesDialogOpen] = useState(false);
  const seasonDetailHistoryActiveRef = useRef(false);
  const selectedSeasonIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedSeasonIdRef.current = selectedSeasonId;
  }, [selectedSeasonId]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state?.ounwanSeasonDetail) {
        seasonDetailHistoryActiveRef.current = true;
        selectedSeasonIdRef.current = event.state.ounwanSeasonDetail;
        setSelectedSeasonId(event.state.ounwanSeasonDetail);
        return;
      }

      if (seasonDetailHistoryActiveRef.current || selectedSeasonIdRef.current) {
        seasonDetailHistoryActiveRef.current = false;
        selectedSeasonIdRef.current = null;
        setSelectedSeasonId(null);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const openSeasonDetail = (seasonId: string) => {
    seasonDetailHistoryActiveRef.current = true;
    selectedSeasonIdRef.current = seasonId;
    window.history.replaceState({ ounwanMorePage: "season-management" }, "");
    window.history.pushState({ ounwanMorePage: "season-management", ounwanSeasonDetail: seasonId }, "");
    setSelectedSeasonId(seasonId);
  };

  const closeSeasonDetail = () => {
    if (seasonDetailHistoryActiveRef.current) {
      seasonDetailHistoryActiveRef.current = false;
      window.history.back();
      return;
    }

    selectedSeasonIdRef.current = null;
    setSelectedSeasonId(null);
  };

  const handlePendingSeasonDeleted = () => {
    setDeletePendingSeasonDialogOpen(false);
    closeSeasonDetail();
    router.refresh();
  };

  const handlePendingSeasonActivated = () => {
    setActivatePendingSeasonDialogOpen(false);
    router.refresh();
  };

  const sortedSeasons = useMemo(() => [...seasons].sort(compareSeasonByStartDateDesc), [seasons]);
  const selectedSeason = sortedSeasons.find((season) => season.id === selectedSeasonId) ?? null;
  const participantsBySeasonId = useMemo(() => groupParticipantsBySeason(seasonParticipants), [seasonParticipants]);
  const activeSeason = sortedSeasons.find((season) => season.status === "active");
  const pendingSeason = sortedSeasons.find((season) => season.status === "pending");
  const nextPendingSeason = pendingSeason;

  if (selectedSeason) {
    const participants = participantsBySeasonId.get(selectedSeason.id) ?? [];

    return (
      <div className="space-y-4 p-4">
        <SeasonManagementHeader title="시즌 상세" onBack={closeSeasonDetail} />

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-extrabold text-slate-950">{selectedSeason.name}</h2>
              <p className="mt-1 text-sm font-bold text-slate-500">{formatDateRange(selectedSeason.startDate, selectedSeason.endDate)}</p>
            </div>
            <SeasonStatusBadge status={selectedSeason.status} />
          </div>
        </section>

        <SeasonRulesCard
          season={selectedSeason}
          onEdit={() => {
            if (selectedSeason.status === "closed") {
              return;
            }

            setSeasonRulesDialogOpen(true);
          }}
        />

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-extrabold text-slate-950">참가자 목록</h3>
            <span className="text-xs font-extrabold text-slate-400">{participants.length}명</span>
          </div>
          <div className="divide-y divide-slate-100">
            {participants.map((participant) => (
              <SeasonParticipantRow
                key={participant.user.id}
                participant={participant}
                onOpen={() => setSelectedParticipant(participant)}
              />
            ))}
            {participants.length === 0 && <p className="px-4 py-8 text-center text-sm font-semibold text-slate-400">참가자가 없습니다.</p>}
          </div>
        </section>

        {selectedSeason.status === "active" && (
          <button
            type="button"
            className="min-h-12 w-full rounded-2xl border border-red-200 bg-white text-sm font-extrabold text-red-500 active:bg-red-50"
            onClick={() => setCloseSeasonDialogOpen(true)}
          >
            시즌 종료
          </button>
        )}

        {selectedSeason.status === "pending" && (
          <div className="space-y-2">
            <button
              type="button"
              className="min-h-12 w-full rounded-2xl bg-slate-950 px-4 text-sm font-extrabold text-white active:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400"
              disabled={Boolean(activeSeason)}
              onClick={() => setActivatePendingSeasonDialogOpen(true)}
            >
              시즌 시작하기
            </button>
            {activeSeason && (
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs font-bold leading-5 text-slate-500">
                진행중인 시즌을 먼저 종료해야 대기중 시즌을 시작할 수 있습니다.
              </p>
            )}
            <button
              type="button"
              className="min-h-12 w-full rounded-2xl border border-red-200 bg-white text-sm font-extrabold text-red-500 active:bg-red-50"
              onClick={() => setDeletePendingSeasonDialogOpen(true)}
            >
              대기중 시즌 삭제
            </button>
          </div>
        )}
        <ParticipantDetailDialog participant={selectedParticipant} onClose={() => setSelectedParticipant(null)} />
        <SeasonRulesDialog
          open={seasonRulesDialogOpen}
          season={selectedSeason}
          onClose={() => setSeasonRulesDialogOpen(false)}
          onSaved={() => {
            setSeasonRulesDialogOpen(false);
            router.refresh();
          }}
        />
        <SeasonCloseDialog
          open={closeSeasonDialogOpen}
          season={selectedSeason}
          duePendingSeason={nextPendingSeason}
          onClose={() => setCloseSeasonDialogOpen(false)}
          onClosed={() => {
            setCloseSeasonDialogOpen(false);
            router.refresh();
          }}
        />
        <PendingSeasonDeleteDialog
          open={deletePendingSeasonDialogOpen}
          season={selectedSeason}
          onClose={() => setDeletePendingSeasonDialogOpen(false)}
          onDeleted={handlePendingSeasonDeleted}
        />
        <PendingSeasonActivateDialog
          open={activatePendingSeasonDialogOpen}
          season={selectedSeason}
          onClose={() => setActivatePendingSeasonDialogOpen(false)}
          onActivated={handlePendingSeasonActivated}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <SeasonManagementHeader title="시즌 관리" onBack={onBack} />

      <button
        type="button"
        className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-extrabold text-white active:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400"
        disabled={Boolean(pendingSeason)}
        onClick={() => setCreateSeasonDialogOpen(true)}
      >
        새 시즌 추가
      </button>

      {pendingSeason && (
        <p className="rounded-2xl bg-[#F7F5FF] px-4 py-3 text-xs font-bold leading-5 text-[#51438f]">
          이미 대기중인 시즌이 있어 새 시즌을 추가할 수 없습니다.
        </p>
      )}

      <div className="space-y-3">
        {sortedSeasons.map((season) => {
          const participantCount = participantsBySeasonId.get(season.id)?.length ?? 0;
          return (
            <button
              key={season.id}
              type="button"
              className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left active:bg-slate-50"
              onClick={() => openSeasonDetail(season.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-extrabold text-slate-950">{season.name}</h2>
                  <p className="mt-1 text-sm font-bold text-slate-500">{formatDateRange(season.startDate, season.endDate)}</p>
                </div>
                <SeasonStatusBadge status={season.status} />
              </div>
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="text-xs font-bold text-slate-400">참가자</span>
                <span className="text-sm font-extrabold text-slate-900">{participantCount}명</span>
              </div>
            </button>
          );
        })}
      </div>

      <CreateSeasonDialog open={createSeasonDialogOpen} onClose={() => setCreateSeasonDialogOpen(false)} />
    </div>
  );
}

function SeasonManagementHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex h-10 items-center justify-between">
      <button type="button" className="grid h-10 w-10 place-items-center rounded-full text-slate-700 active:bg-slate-100" aria-label="뒤로가기" onClick={onBack}>
        <svg
          aria-hidden="true"
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <h1 className="text-base font-extrabold text-slate-950">{title}</h1>
      <div className="h-10 w-10" aria-hidden="true" />
    </div>
  );
}

function SeasonStatusBadge({ status }: { status: Season["status"] }) {
  const statusMeta = {
    pending: { label: "대기중", className: "bg-[#F2F0FA] text-[#51438f]" },
    active: { label: "진행중", className: "bg-[#5e4ea5] text-white" },
    closed: { label: "종료", className: "bg-slate-100 text-slate-500" },
  }[status];

  return <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-extrabold ${statusMeta.className}`}>{statusMeta.label}</span>;
}

function SeasonParticipantRow({
  participant,
  onOpen,
}: {
  participant: SeasonParticipantMember;
  onOpen: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={onOpen}>
        <Avatar name={participant.user.name} imageUrl={participant.user.avatarUrl} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-slate-950">{participant.user.name}</p>
          <div className="mt-0.5 space-y-0.5">
            {participant.periods.map((period) => (
              <p key={period.id} className="text-xs font-semibold leading-4 text-slate-400">
                {formatDateRange(period.startDate, period.endDate)}
              </p>
            ))}
          </div>
        </div>
      </button>
    </div>
  );
}

function SeasonRulesCard({ season, onEdit }: { season: Season; onEdit: () => void }) {
  const canEdit = season.status !== "closed";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-extrabold text-slate-950">{season.name}의 규칙</h3>
        {canEdit && (
          <button type="button" className="rounded-full bg-[#F2F0FA] px-3 py-1.5 text-xs font-extrabold text-[#51438f] active:bg-[#e7e1fb]" onClick={onEdit}>
            수정
          </button>
        )}
      </div>
      <div className="mt-4 space-y-2.5 text-sm font-semibold leading-6 text-slate-700">
        <p>
          한 주는 <SeasonRuleValue>{formatWeekday(season.weekStartDay)}</SeasonRuleValue>에 시작해요.
        </p>
        <p>
          하루는 <SeasonRuleValue>{formatTime(season.dayStartTime)}</SeasonRuleValue>부터 시작해요.
        </p>
        <p>
          하루에 여러 번 인증하면 <SeasonRuleValue>{formatDuplicatePolicy(season.dailyDuplicatePolicy)}</SeasonRuleValue> 인정해요.
        </p>
        <p>
          일주일에 최소 <SeasonRuleValue>{season.targetWorkoutCountPerWeek}회</SeasonRuleValue> 인증해야 해요.
        </p>
        <p>
          인증이 1회 부족할 때마다 <SeasonRuleValue>{formatCurrency(season.finePerMiss)}</SeasonRuleValue>의 벌금이 부과돼요.
        </p>
      </div>
    </section>
  );
}

function SeasonRuleValue({ children }: { children: ReactNode }) {
  return <span className="inline-flex rounded-full bg-[#F7F5FF] px-2.5 py-1 text-sm font-extrabold text-[#51438f]">{children}</span>;
}

function SeasonRulesDialog({
  open,
  season,
  onClose,
  onSaved,
}: {
  open: boolean;
  season: Season;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (open) {
      setErrorMessage("");
    }
  }, [open, season.id]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateSeasonRulesAction({ status: "idle", message: "" }, formData);
      if (result.status === "error") {
        setErrorMessage(result.message);
        return;
      }

      onSaved();
    });
  };

  return (
    <AppDialog open={open} title={season.name + "의 규칙"} onClose={onClose} dismissOnBackdrop={false} footer={null}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <input type="hidden" name="seasonId" value={season.id} />

        <label className="block space-y-2">
          <span className="text-sm font-extrabold text-slate-700">한 주의 시작요일 <span className="text-red-500" aria-hidden="true">*</span></span>
          <select name="weekStartDay" defaultValue={season.weekStartDay} required className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm leading-5 text-slate-950 outline-none transition focus:border-[#5e4ea5] focus:ring-4 focus:ring-[#5e4ea5]/10">
            {weekdays.map((weekday) => (
              <option key={weekday.value} value={weekday.value}>{weekday.label}</option>
            ))}
          </select>
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-extrabold text-slate-700">하루의 시작 시각 <span className="text-red-500" aria-hidden="true">*</span></span>
          <input type="time" name="dayStartTime" step={60} required defaultValue={formatTimeInputValue(season.dayStartTime)} className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm leading-5 text-slate-950 outline-none transition focus:border-[#5e4ea5] focus:ring-4 focus:ring-[#5e4ea5]/10" />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-extrabold text-slate-700">일일 중복 인증 <span className="text-red-500" aria-hidden="true">*</span></span>
          <select name="dailyDuplicatePolicy" defaultValue={season.dailyDuplicatePolicy} required className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm leading-5 text-slate-950 outline-none transition focus:border-[#5e4ea5] focus:ring-4 focus:ring-[#5e4ea5]/10">
            <option value="count_once">1회만</option>
            <option value="count_all">인증한 만큼</option>
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-2">
            <span className="text-sm font-extrabold text-slate-700">주간 목표 (인증 횟수) <span className="text-red-500" aria-hidden="true">*</span></span>
            <input
              type="number"
              name="targetWorkoutCountPerWeek"
              min={1}
              defaultValue={season.targetWorkoutCountPerWeek}
              className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm leading-5 text-slate-950 outline-none transition focus:border-[#5e4ea5] focus:ring-4 focus:ring-[#5e4ea5]/10"
              required
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-extrabold text-slate-700">벌금 (단위: 원) <span className="text-red-500" aria-hidden="true">*</span></span>
            <input
              type="number"
              name="finePerMiss"
              min={0}
              step={100}
              defaultValue={season.finePerMiss}
              className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm leading-5 text-slate-950 outline-none transition focus:border-[#5e4ea5] focus:ring-4 focus:ring-[#5e4ea5]/10"
              required
            />
          </label>
        </div>

        {errorMessage && <p className="text-sm font-bold text-red-600">{errorMessage}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-950 disabled:bg-slate-200 disabled:text-slate-400" disabled={isPending} onClick={onClose}>
            취소
          </button>
          <button type="submit" className="min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-extrabold text-white disabled:bg-slate-200 disabled:text-slate-400" disabled={isPending}>
            {isPending ? "저장 중" : "저장"}
          </button>
        </div>
      </form>
    </AppDialog>
  );
}

function ParticipantDetailDialog({ participant, onClose }: { participant: SeasonParticipantMember | null; onClose: () => void }) {
  return (
    <AppDialog open={Boolean(participant)} title={participant?.user.name ?? "참가자 상세"} onClose={onClose} dismissOnBackdrop actions={[{ label: "닫기", onClick: onClose }]}>
      <div className="grid grid-cols-2 gap-2">
        <SeasonMetric label="총 인증 횟수" value="추후 제공" />
        <SeasonMetric label="총 벌금" value="추후 제공" />
      </div>
    </AppDialog>
  );
}

function SeasonMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 text-center">
      <p className="text-xs font-bold text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-extrabold text-slate-950">{value}</p>
    </div>
  );
}

function CreateSeasonDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AppDialog open={open} title="새 시즌 추가" onClose={onClose} dismissOnBackdrop footer={null}>
      <SeasonCreateForm onCreated={onClose} />
    </AppDialog>
  );
}

function SeasonCloseDialog({
  open,
  season,
  duePendingSeason,
  onClose,
  onClosed,
}: {
  open: boolean;
  season: Season;
  duePendingSeason?: Season;
  onClose: () => void;
  onClosed: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState("");

  const handleCloseSeason = (activatePendingSeason: boolean) => {
    const formData = new FormData();
    formData.set("seasonId", season.id);
    formData.set("activatePendingSeason", String(activatePendingSeason));
    setErrorMessage("");

    startTransition(async () => {
      const result = await closeSeasonAction(formData);
      if (result.status === "error") {
        setErrorMessage(result.message);
        return;
      }

      onClosed();
    });
  };

  return (
    <AppDialog
      open={open}
      title="시즌 종료"
      description={duePendingSeason ? `대기중인 ${duePendingSeason.name} 시즌도 바로 진행중으로 전환할까요?` : "현재 진행중인 시즌을 종료할까요?"}
      onClose={onClose}
      dismissOnBackdrop={false}
      role="alertdialog"
      footer={
        <div className="flex w-full flex-col gap-2">
          {errorMessage && <p className="text-sm font-bold text-red-600">{errorMessage}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-950 disabled:bg-slate-200 disabled:text-slate-400" disabled={isPending} onClick={onClose}>
              취소
            </button>
            {duePendingSeason && (
              <button type="button" className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-950 disabled:bg-slate-200 disabled:text-slate-400" disabled={isPending} onClick={() => handleCloseSeason(false)}>
                종료만
              </button>
            )}
            <button type="button" className="min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-extrabold text-white disabled:bg-slate-200 disabled:text-slate-400" disabled={isPending} onClick={() => handleCloseSeason(Boolean(duePendingSeason))}>
              {duePendingSeason ? "종료 후 활성화" : "종료"}
            </button>
          </div>
        </div>
      }
    />
  );
}

function PendingSeasonActivateDialog({
  open,
  season,
  onClose,
  onActivated,
}: {
  open: boolean;
  season: Season;
  onClose: () => void;
  onActivated: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState("");

  const handleActivate = () => {
    setErrorMessage("");

    startTransition(async () => {
      const result = await activatePendingSeasonAction();
      if (result.status === "error") {
        setErrorMessage(result.message);
        return;
      }

      onActivated();
    });
  };

  return (
    <AppDialog
      open={open}
      title="대기중 시즌 시작"
      description={`${season.name} 시즌을 지금 시작할까요? 시작일은 오늘 날짜로 갱신됩니다.`}
      onClose={onClose}
      dismissOnBackdrop={false}
      role="alertdialog"
      footer={
        <div className="flex w-full flex-col gap-2">
          {errorMessage && <p className="text-sm font-bold text-red-600">{errorMessage}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-950 disabled:bg-slate-200 disabled:text-slate-400" disabled={isPending} onClick={onClose}>
              취소
            </button>
            <button type="button" className="min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-extrabold text-white disabled:bg-slate-200 disabled:text-slate-400" disabled={isPending} onClick={handleActivate}>
              시작
            </button>
          </div>
        </div>
      }
    />
  );
}
function PendingSeasonDeleteDialog({
  open,
  season,
  onClose,
  onDeleted,
}: {
  open: boolean;
  season: Season;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState("");

  const handleDelete = () => {
    const formData = new FormData();
    formData.set("seasonId", season.id);
    setErrorMessage("");

    startTransition(async () => {
      const result = await deletePendingSeasonAction(formData);
      if (result.status === "error") {
        setErrorMessage(result.message);
        return;
      }

      onDeleted();
    });
  };

  return (
    <AppDialog
      open={open}
      title="대기중 시즌 삭제"
      description="삭제한 대기중 시즌은 복구할 수 없습니다."
      onClose={onClose}
      dismissOnBackdrop={false}
      role="alertdialog"
      footer={
        <div className="flex w-full flex-col gap-2">
          {errorMessage && <p className="text-sm font-bold text-red-600">{errorMessage}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-950 disabled:bg-slate-200 disabled:text-slate-400" disabled={isPending} onClick={onClose}>
              취소
            </button>
            <button type="button" className="min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-extrabold text-white disabled:bg-slate-200 disabled:text-slate-400" disabled={isPending} onClick={handleDelete}>
              삭제
            </button>
          </div>
        </div>
      }
    />
  );
}

function groupParticipantsBySeason(participants: SeasonParticipant[]) {
  const map = new Map<string, SeasonParticipantMember[]>();

  participants.forEach((participant) => {
    const list = map.get(participant.seasonId) ?? [];
    const existingMember = list.find((member) => member.user.id === participant.user.id);
    const period = {
      id: participant.id,
      startDate: participant.startDate,
      endDate: participant.endDate,
    };

    if (existingMember) {
      existingMember.periods.push(period);
    } else {
      list.push({ seasonId: participant.seasonId, user: participant.user, periods: [period] });
    }

    map.set(participant.seasonId, list);
  });

  map.forEach((members) => {
    members.forEach((member) => member.periods.sort(comparePeriodByStartDate));
  });

  return map;
}

const weekdays = [
  { value: 0, label: "월요일" },
  { value: 1, label: "화요일" },
  { value: 2, label: "수요일" },
  { value: 3, label: "목요일" },
  { value: 4, label: "금요일" },
  { value: 5, label: "토요일" },
  { value: 6, label: "일요일" },
];

function formatWeekday(value: number) {
  return weekdays.find((weekday) => weekday.value === value)?.label ?? "월요일";
}

function formatTime(value: string) {
  return formatTimeInputValue(value);
}

function formatTimeInputValue(value: string) {
  return value.slice(0, 5);
}

function formatDuplicatePolicy(value: Season["dailyDuplicatePolicy"]) {
  return value === "count_all" ? "인증한 만큼" : "1회만";
}

function formatCurrency(value: number) {
  return value.toLocaleString("ko-KR") + "원";
}

function compareSeasonByStartDateDesc(a: Season, b: Season) {
  return b.startDate.localeCompare(a.startDate) || b.id.localeCompare(a.id);
}

function comparePeriodByStartDate(a: Pick<SeasonParticipant, "startDate">, b: Pick<SeasonParticipant, "startDate">) {
  return a.startDate.localeCompare(b.startDate);
}

function formatDateRange(startDate: string, endDate?: string) {
  return `${formatSystemDate(startDate)} ~${endDate ? ` ${formatSystemDate(endDate)}` : ""}`;
}
