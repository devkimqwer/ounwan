import { type FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createGroupInviteAction, expelGroupMemberAction, regenerateGroupInviteAction, reviewGroupJoinRequestAction, updateGroupMemberRolesAction } from "@/app/actions";
import type { ExpelGroupMemberState } from "@/app/actions";
import type { AdminGroupMember, AdminGroupMemberStatus, AdminGroupMemberStatusFilter } from "@/domain/models";
import { formatSystemDate, formatSystemDateTime } from "@/lib/date-format";
import { AppDialog } from "@/components/ui/app-dialog";
import { Avatar, Badge, getRoleBadgeTone, getRoleLabel } from "./shared-ui";

type GroupMemberManagementViewProps = {
  members: AdminGroupMember[];
  onBack: () => void;
};

type MemberStatusFilter = AdminGroupMemberStatusFilter;
type ReviewDecision = "approve" | "reject";

const expelInitialState: ExpelGroupMemberState = { status: "idle", message: "" };

const statusFilterOptions: Array<{ value: MemberStatusFilter; label: string }> = [
  { value: "approved", label: "승인" },
  { value: "pending", label: "대기" },
  { value: "all", label: "전체" },
];

export function GroupMemberManagementView({ members, onBack }: GroupMemberManagementViewProps) {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<MemberStatusFilter>("approved");
  const [selectedMember, setSelectedMember] = useState<AdminGroupMember | null>(null);
  const [memberMenu, setMemberMenu] = useState<AdminGroupMember | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{ member: AdminGroupMember; decision: ReviewDecision } | null>(null);
  const [roleTarget, setRoleTarget] = useState<AdminGroupMember | null>(null);
  const [expelTarget, setExpelTarget] = useState<AdminGroupMember | null>(null);
  const [reviewError, setReviewError] = useState("");
  const [isReviewSubmitting, setIsReviewSubmitting] = useState(false);
  const [roleError, setRoleError] = useState("");
  const [isRoleSubmitting, setIsRoleSubmitting] = useState(false);
  const [expelState, setExpelState] = useState<ExpelGroupMemberState>(expelInitialState);
  const [isExpelSubmitting, setIsExpelSubmitting] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [inviteExpiresAt, setInviteExpiresAt] = useState<string | undefined>();
  const [inviteError, setInviteError] = useState("");
  const [inviteCopied, setInviteCopied] = useState(false);
  const [regenerateInviteDialogOpen, setRegenerateInviteDialogOpen] = useState(false);
  const [isInviteLoading, setIsInviteLoading] = useState(false);

  const pendingMemberCount = useMemo(() => members.filter((member) => member.status === "pending").length, [members]);

  const filteredMembers = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return members.filter((member) => {
      if (statusFilter !== "all" && member.status !== statusFilter) {
        return false;
      }

      if (!normalizedKeyword) {
        return true;
      }

      return [member.user.name, member.user.publicId]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedKeyword));
    });
  }, [keyword, members, statusFilter]);

  const handleInviteOpen = async () => {
    setInviteDialogOpen(true);
    setInviteError("");
    setInviteCopied(false);

    if (inviteLink || isInviteLoading) {
      return;
    }

    setIsInviteLoading(true);

    try {
      const result = await createGroupInviteAction();
      if (result.status !== "success" || !result.invitePath) {
        setInviteError(result.message);
        return;
      }

      setInviteLink(`${window.location.origin}${result.invitePath}`);
      setInviteExpiresAt(result.expiresAt);
    } catch {
      setInviteError("초대 링크를 생성할 수 없습니다.");
    } finally {
      setIsInviteLoading(false);
    }
  };

  const handleInviteCopy = async () => {
    if (!inviteLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(inviteLink);
      setInviteCopied(true);
    } catch {
      setInviteError("복사에 실패했습니다. 링크를 직접 선택해서 복사해주세요.");
    }
  };

  const handleInviteRegenerate = async () => {
    if (isInviteLoading) {
      return;
    }

    setIsInviteLoading(true);
    setInviteError("");
    setInviteCopied(false);

    try {
      const result = await regenerateGroupInviteAction();
      if (result.status !== "success" || !result.invitePath) {
        setInviteError(result.message);
        return;
      }

      setInviteLink(`${window.location.origin}${result.invitePath}`);
      setInviteExpiresAt(result.expiresAt);
      setRegenerateInviteDialogOpen(false);
    } catch {
      setInviteError("초대 링크를 새로 발급할 수 없습니다.");
    } finally {
      setIsInviteLoading(false);
    }
  };

  const handleReviewOpen = (member: AdminGroupMember, decision: ReviewDecision) => {
    setMemberMenu(null);
    setReviewError("");
    setReviewTarget({ member, decision });
  };

  const handleRoleChangeOpen = (member: AdminGroupMember) => {
    setMemberMenu(null);
    setRoleError("");
    setRoleTarget(member);
  };

  const handleExpelOpen = (member: AdminGroupMember) => {
    setMemberMenu(null);
    setExpelState(expelInitialState);
    setExpelTarget(member);
  };

  const handleStatusFilterChange = (nextStatusFilter: MemberStatusFilter) => {
    setStatusFilter(nextStatusFilter);
    router.refresh();
  };

  const handleRoleChangeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!roleTarget || isRoleSubmitting) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const shouldCloseManagementView = formData.get("delegateAdmin") === "on";
    setIsRoleSubmitting(true);
    setRoleError("");

    try {
      const result = await updateGroupMemberRolesAction(formData);
      if (result.status === "error") {
        setRoleError(result.message);
        return;
      }

      setRoleTarget(null);
      if (shouldCloseManagementView) {
        onBack();
      }
      router.refresh();
    } catch {
      setRoleError("역할을 변경할 수 없습니다.");
    } finally {
      setIsRoleSubmitting(false);
    }
  };

  const handleExpelConfirm = async () => {
    if (!expelTarget || isExpelSubmitting) {
      return;
    }

    const formData = new FormData();
    formData.set("userId", expelTarget.user.id);
    setIsExpelSubmitting(true);
    setExpelState(expelInitialState);

    try {
      const result = await expelGroupMemberAction(formData);
      setExpelState(result);
      if (result.status === "error") {
        return;
      }

      setExpelTarget(null);
      router.refresh();
    } catch {
      setExpelState({ status: "error", message: "멤버를 추방할 수 없습니다." });
    } finally {
      setIsExpelSubmitting(false);
    }
  };
  const handleReviewConfirm = async () => {
    if (!reviewTarget?.member.requestId || isReviewSubmitting) {
      return;
    }

    const formData = new FormData();
    formData.set("requestId", reviewTarget.member.requestId);
    formData.set("decision", reviewTarget.decision);
    setIsReviewSubmitting(true);
    setReviewError("");

    try {
      await reviewGroupJoinRequestAction(formData);
      setReviewTarget(null);
      router.refresh();
    } catch {
      setReviewError("참여 요청을 처리할 수 없습니다.");
    } finally {
      setIsReviewSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <GroupMemberManagementHeader title="그룹 멤버 관리" onBack={onBack} />

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="block">
          <span className="sr-only">이름 또는 아이디 검색</span>
          <div className="flex min-h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3">
            <svg aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm leading-5 text-slate-950 outline-none placeholder:text-sm placeholder:text-slate-400"
              placeholder="이름 또는 아이디 검색"
            />
          </div>
        </label>

        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1">
          {statusFilterOptions.map((option) => {
            const selected = option.value === statusFilter;
            return (
              <button
                key={option.value}
                type="button"
                className={`relative min-h-10 rounded-xl text-sm font-extrabold ${selected ? "bg-white text-[#51438f] shadow-sm" : "text-slate-500"}`}
                aria-label={option.value === "pending" && pendingMemberCount > 0 ? `${option.label} ${pendingMemberCount}건` : option.label}
                onClick={() => handleStatusFilterChange(option.value)}
              >
                <span className="inline-flex items-center gap-1.5">
                  {option.label}
                  {option.value === "pending" && pendingMemberCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden="true" />}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <button
        type="button"
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-extrabold text-white active:bg-slate-800"
        onClick={handleInviteOpen}
      >
        <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" x2="19" y1="8" y2="14" />
          <line x1="22" x2="16" y1="11" y2="11" />
        </svg>
        멤버 초대하기
      </button>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-extrabold text-slate-950">멤버 목록</h2>
          <span className="text-xs font-extrabold text-slate-400">{filteredMembers.length}명</span>
        </div>
        <div className="divide-y divide-slate-100">
          {filteredMembers.map((member) => (
            <GroupMemberRow key={member.id} member={member} onOpen={() => setSelectedMember(member)} onOpenMenu={() => setMemberMenu(member)} />
          ))}
          {filteredMembers.length === 0 && <p className="px-4 py-8 text-center text-sm font-semibold text-slate-400">표시할 멤버가 없습니다.</p>}
        </div>
      </section>

      <InviteDialog
        open={inviteDialogOpen}
        inviteLink={inviteLink}
        expiresAt={inviteExpiresAt}
        error={inviteError}
        copied={inviteCopied}
        loading={isInviteLoading}
        onCopy={handleInviteCopy}
        onRegenerate={() => setRegenerateInviteDialogOpen(true)}
        onClose={() => setInviteDialogOpen(false)}
      />
      <RegenerateInviteDialog
        open={regenerateInviteDialogOpen}
        submitting={isInviteLoading}
        error={inviteError}
        onConfirm={handleInviteRegenerate}
        onClose={() => setRegenerateInviteDialogOpen(false)}
      />
      <MemberDetailDialog member={selectedMember} onClose={() => setSelectedMember(null)} />
      <MemberMenuDialog member={memberMenu} onReview={handleReviewOpen} onRoleChange={handleRoleChangeOpen} onExpel={handleExpelOpen} onClose={() => setMemberMenu(null)} />
      <RoleChangeDialog target={roleTarget} error={roleError} submitting={isRoleSubmitting} onSubmit={handleRoleChangeSubmit} onClose={() => setRoleTarget(null)} />
      <ExpelMemberDialog target={expelTarget} state={expelState} submitting={isExpelSubmitting} onConfirm={handleExpelConfirm} onClose={() => setExpelTarget(null)} />
      <JoinRequestReviewDialog target={reviewTarget} error={reviewError} submitting={isReviewSubmitting} onConfirm={handleReviewConfirm} onClose={() => setReviewTarget(null)} />
    </div>
  );
}

function GroupMemberManagementHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex h-10 items-center justify-between">
      <button type="button" className="grid h-10 w-10 place-items-center rounded-full text-slate-700 active:bg-slate-100" aria-label="뒤로가기" onClick={onBack}>
        <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <h1 className="text-base font-extrabold text-slate-950">{title}</h1>
      <div className="h-10 w-10" aria-hidden="true" />
    </div>
  );
}

function GroupMemberRow({ member, onOpen, onOpenMenu }: { member: AdminGroupMember; onOpen: () => void; onOpenMenu: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={onOpen}>
        <Avatar name={member.user.name} imageUrl={member.user.avatarUrl} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-extrabold text-slate-950">{member.user.name}</p>
            <MemberStatusBadge status={member.status} />
          </div>
          <p className="mt-0.5 truncate text-xs font-semibold text-slate-400">@{member.user.publicId}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {member.roles.length > 0 ? (
              member.roles.map((role) => (
                <Badge key={role} tone={getRoleBadgeTone(role)}>
                  {getRoleLabel(role)}
                </Badge>
              ))
            ) : (
              <Badge tone="slate">역할 없음</Badge>
            )}
          </div>
        </div>
      </button>
      <button
        type="button"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-500 active:bg-slate-100"
        aria-label={`${member.user.name} 멤버 설정`}
        onClick={onOpenMenu}
      >
        <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
          <circle cx="5" cy="12" r="1" />
        </svg>
      </button>
    </div>
  );
}

function MemberStatusBadge({ status }: { status: AdminGroupMemberStatus }) {
  const className = status === "approved" ? "bg-[#F2F0FA] text-[#51438f]" : status === "pending" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500";
  const label = status === "approved" ? "승인" : status === "pending" ? "대기" : "전체";

  return <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-extrabold leading-none ${className}`}>{label}</span>;
}

function InviteDialog({
  open,
  inviteLink,
  expiresAt,
  error,
  copied,
  loading,
  onCopy,
  onRegenerate,
  onClose,
}: {
  open: boolean;
  inviteLink: string;
  expiresAt?: string;
  error: string;
  copied: boolean;
  loading: boolean;
  onCopy: () => void;
  onRegenerate: () => void;
  onClose: () => void;
}) {
  return (
    <AppDialog open={open} title="멤버 초대" onClose={onClose} dismissOnBackdrop actions={[{ label: "닫기", onClick: onClose }]}>
      <div className="space-y-3">
        <p className="text-sm font-semibold leading-5 text-slate-500">초대 링크를 받은 사용자는 참여 요청 후 관리자 승인을 받아야 합니다.</p>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-extrabold text-slate-400">공유 링크</p>
          <p className="mt-2 break-all text-sm font-bold text-slate-800">{loading ? "생성 중입니다." : inviteLink || "링크를 생성할 수 없습니다."}</p>
          {expiresAt && <p className="mt-2 text-xs font-semibold text-slate-400">만료: {formatSystemDateTime(expiresAt)}</p>}
        </div>
        {error && <p className="text-sm font-bold text-red-500">{error}</p>}
        {copied && <p className="text-sm font-bold text-[#51438f]">복사됐습니다.</p>}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!inviteLink || loading}
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-950 disabled:bg-slate-100 disabled:text-slate-400"
            onClick={onRegenerate}
          >
            새 링크 발급
          </button>
          <button
            type="button"
            disabled={!inviteLink || loading}
            className="min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-extrabold text-white disabled:bg-slate-200 disabled:text-slate-400"
            onClick={onCopy}
          >
            링크 복사
          </button>
        </div>
      </div>
    </AppDialog>
  );
}

function RegenerateInviteDialog({
  open,
  submitting,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  submitting: boolean;
  error: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <AppDialog
      open={open}
      title="초대 링크 새로 발급"
      description="기존 초대 링크는 즉시 만료되고 새 링크가 발급됩니다. 계속할까요?"
      onClose={onClose}
      dismissOnBackdrop={!submitting}
      role="alertdialog"
      footer={
        <>
          <button
            type="button"
            disabled={submitting}
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-950 disabled:bg-slate-100 disabled:text-slate-400"
            onClick={onClose}
          >
            취소
          </button>
          <button
            type="button"
            disabled={submitting}
            className="min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-extrabold text-white disabled:bg-slate-200 disabled:text-slate-400"
            onClick={onConfirm}
          >
            {submitting ? "발급 중" : "새로 발급"}
          </button>
        </>
      }
    >
      {error && <p className="text-sm font-bold text-red-500">{error}</p>}
    </AppDialog>
  );
}
function MemberDetailDialog({ member, onClose }: { member: AdminGroupMember | null; onClose: () => void }) {
  return (
    <AppDialog open={Boolean(member)} title={member?.user.name ?? "멤버 상세"} onClose={onClose} dismissOnBackdrop actions={[{ label: "닫기", onClick: onClose }]}>
      {member && (
        <div className="space-y-3">
          <MemberInfoRow label="ID" value={`@${member.user.publicId}`} />
          <MemberInfoRow label="상태" value={member.status === "approved" ? "승인된 멤버" : "승인 대기"} />
          {member.joinedAt && <MemberInfoRow label="가입일" value={formatSystemDate(member.joinedAt)} />}
          {member.requestedAt && <MemberInfoRow label="요청일" value={formatSystemDateTime(member.requestedAt)} />}
        </div>
      )}
    </AppDialog>
  );
}

function MemberMenuDialog({
  member,
  onReview,
  onRoleChange,
  onExpel,
  onClose,
}: {
  member: AdminGroupMember | null;
  onReview: (member: AdminGroupMember, decision: ReviewDecision) => void;
  onRoleChange: (member: AdminGroupMember) => void;
  onExpel: (member: AdminGroupMember) => void;
  onClose: () => void;
}) {
  return (
    <AppDialog open={Boolean(member)} title={member?.user.name ?? "멤버 설정"} onClose={onClose} dismissOnBackdrop footer={null}>
      {member?.status === "pending" ? (
        <div className="space-y-1">
          <MemberMenuButton label="참여 요청 승인하기" onClick={() => onReview(member, "approve")} />
          <MemberMenuButton label="참여 요청 반려하기" onClick={() => onReview(member, "reject")} />
        </div>
      ) : (
        <div className="space-y-1">
          <MemberMenuButton label="역할 변경" onClick={() => member && onRoleChange(member)} />
          {member && !member.isCurrentUser && <MemberMenuButton label="추방하기" onClick={() => onExpel(member)} />}
        </div>
      )}
    </AppDialog>
  );
}

function ExpelMemberDialog({
  target,
  state,
  submitting,
  onConfirm,
  onClose,
}: {
  target: AdminGroupMember | null;
  state: ExpelGroupMemberState;
  submitting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <AppDialog
      open={Boolean(target)}
      title="멤버 추방"
      description={target ? `${target.user.name}님을 그룹에서 추방하시겠습니까?` : undefined}
      onClose={onClose}
      dismissOnBackdrop={!submitting}
      role="alertdialog"
      footer={
        <>
          <button
            type="button"
            disabled={submitting}
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-950 disabled:bg-slate-100 disabled:text-slate-400"
            onClick={onClose}
          >
            취소
          </button>
          <button
            type="button"
            disabled={submitting || !target}
            className="min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-extrabold text-white disabled:bg-slate-200 disabled:text-slate-400"
            onClick={onConfirm}
          >
            {submitting ? "처리 중" : "추방"}
          </button>
        </>
      }
    >
      {state.message && <p className={`text-sm font-bold ${state.status === "error" ? "text-red-500" : "text-slate-500"}`}>{state.message}</p>}
    </AppDialog>
  );
}
function RoleChangeDialog({
  target,
  error,
  submitting,
  onSubmit,
  onClose,
}: {
  target: AdminGroupMember | null;
  error: string;
  submitting: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  const isAdmin = Boolean(target?.roles.includes("admin"));
  const isTreasurer = Boolean(target?.roles.includes("treasurer"));

  return (
    <AppDialog open={Boolean(target)} title="역할 변경" onClose={onClose} dismissOnBackdrop={!submitting} footer={null}>
      <form className="space-y-4" onSubmit={onSubmit}>
        <input type="hidden" name="userId" value={target?.user.id ?? ""} />

        <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
          <Avatar name={target?.user.name ?? "멤버"} imageUrl={target?.user.avatarUrl} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-slate-950">{target?.user.name}</p>
            <p className="mt-0.5 text-xs font-semibold text-slate-400">@{target?.user.publicId}</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex min-h-12 items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <span className="text-sm font-extrabold text-slate-950">총무</span>
            <input type="checkbox" name="grantTreasurer" defaultChecked={isTreasurer} className="h-5 w-5 accent-[#5e4ea5]" />
          </label>

          {isAdmin ? (
            <div className="rounded-2xl border border-[#DDD8F1] bg-[#F7F5FF] px-4 py-3">
              <p className="text-sm font-extrabold text-[#51438f]">현재 관리자</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">관리자 권한은 다른 멤버에게 위임할 때만 변경됩니다.</p>
            </div>
          ) : (
            <label className="block rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex min-h-6 items-center justify-between gap-3">
                <span className="text-sm font-extrabold text-slate-950">관리자로 위임</span>
                <input type="checkbox" name="delegateAdmin" className="h-5 w-5 accent-[#5e4ea5]" />
              </div>
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">저장하면 기존 관리자는 관리자 권한을 잃고 이 멤버가 새 관리자가 됩니다.</p>
            </label>
          )}
        </div>

        {error && <p className="text-sm font-bold text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" disabled={submitting} className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-950 disabled:bg-slate-100 disabled:text-slate-400" onClick={onClose}>
            취소
          </button>
          <button type="submit" disabled={submitting || !target} className="min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-extrabold text-white disabled:bg-slate-200 disabled:text-slate-400">
            {submitting ? "저장 중" : "저장"}
          </button>
        </div>
      </form>
    </AppDialog>
  );
}

function JoinRequestReviewDialog({
  target,
  error,
  submitting,
  onConfirm,
  onClose,
}: {
  target: { member: AdminGroupMember; decision: ReviewDecision } | null;
  error: string;
  submitting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const actionLabel = target?.decision === "approve" ? "승인" : "반려";

  return (
    <AppDialog
      open={Boolean(target)}
      title={`참여 요청 ${actionLabel}`}
      description={target ? `${target.member.user.name}님의 그룹 참여 요청을 ${actionLabel}하시겠습니까?` : undefined}
      onClose={onClose}
      dismissOnBackdrop={!submitting}
      role="alertdialog"
      footer={
        <>
          <button
            type="button"
            disabled={submitting}
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-950 disabled:bg-slate-100 disabled:text-slate-400"
            onClick={onClose}
          >
            취소
          </button>
          <button
            type="button"
            disabled={submitting}
            className="min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-extrabold text-white disabled:bg-slate-200 disabled:text-slate-400"
            onClick={onConfirm}
          >
            {submitting ? "처리 중" : actionLabel}
          </button>
        </>
      }
    >
      {error && <p className="text-sm font-bold text-red-500">{error}</p>}
    </AppDialog>
  );
}

function MemberMenuButton({ label, badge, onClick }: { label: string; badge?: string; onClick: () => void }) {
  return (
    <button type="button" className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-sm font-extrabold text-slate-950 active:bg-slate-100" onClick={onClick}>
      <span>{label}</span>
      {badge && <span className="text-xs font-bold text-slate-400">{badge}</span>}
    </button>
  );
}

function MemberInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
      <span className="text-xs font-bold text-slate-400">{label}</span>
      <span className="min-w-0 truncate text-sm font-extrabold text-slate-950">{value}</span>
    </div>
  );
}
