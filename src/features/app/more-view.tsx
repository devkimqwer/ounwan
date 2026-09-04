import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { refreshCurrentUserAvatarAction, switchCurrentGroupAction, updateCurrentUserProfileAction } from "@/app/actions";
import type { RefreshCurrentUserAvatarState, UpdateCurrentUserProfileState } from "@/app/actions";
import { AppDialog } from "@/components/ui/app-dialog";
import type { AccountInfo, BankRecord, Group, Settlement, SettlementRow, User, UserGroupMembership } from "@/domain/models";
import { Avatar, Badge, getDisplayRoles, getRoleBadgeTone, getRoleLabel, MenuBlock } from "./shared-ui";

export function MoreView({
  isAdmin,
  isTreasurer,
  currentUser,
  currentGroup,
  approvedGroups,
  accountInfo,
  bankRecords,
  settlement,
  settlementRows,
}: {
  isAdmin: boolean;
  isTreasurer: boolean;
  currentUser: User;
  currentGroup: Group;
  approvedGroups: UserGroupMembership[];
  accountInfo: AccountInfo;
  bankRecords: BankRecord[];
  settlement: Settlement;
  settlementRows: SettlementRow[];
}) {
  const router = useRouter();
  const finalFineTotal = settlementRows.reduce((sum, row) => sum + row.finalFineAmount, 0);
  const profileInitialState: UpdateCurrentUserProfileState = { status: "idle", message: "" };
  const avatarInitialState: RefreshCurrentUserAvatarState = { status: "idle", message: "" };
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [profileName, setProfileName] = useState(currentUser.name);
  const [profileState, setProfileState] = useState<UpdateCurrentUserProfileState>(profileInitialState);
  const [avatarState, setAvatarState] = useState<RefreshCurrentUserAvatarState>(avatarInitialState);
  const [isProfileSubmitting, setIsProfileSubmitting] = useState(false);
  const [isAvatarRefreshing, setIsAvatarRefreshing] = useState(false);
  const [switchingGroupId, setSwitchingGroupId] = useState<string | null>(null);

  useEffect(() => {
    setProfileName(currentUser.name);
  }, [currentUser.name]);

  const roles = getDisplayRoles(isAdmin, isTreasurer);

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isProfileSubmitting) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    setProfileState(profileInitialState);
    setIsProfileSubmitting(true);

    try {
      const result = await updateCurrentUserProfileAction(profileInitialState, formData);
      setProfileState(result);
      if (result.status === "success") {
        setProfileDialogOpen(false);
        router.refresh();
      }
    } catch {
      setProfileState({ status: "error", message: "이름 변경 중 문제가 발생했습니다." });
    } finally {
      setIsProfileSubmitting(false);
    }
  };

  const handleAvatarRefresh = async () => {
    if (isAvatarRefreshing) {
      return;
    }

    setAvatarState(avatarInitialState);
    setIsAvatarRefreshing(true);

    try {
      const result = await refreshCurrentUserAvatarAction(avatarInitialState);
      setAvatarState(result);
      if (result.status === "success") {
        router.refresh();
      }
    } finally {
      setIsAvatarRefreshing(false);
    }
  };

  const handleGroupSwitch = async (groupId: string) => {
    if (groupId === currentGroup.id || switchingGroupId) {
      setGroupDialogOpen(false);
      return;
    }

    const formData = new FormData();
    formData.set("groupId", groupId);
    setSwitchingGroupId(groupId);

    try {
      await switchCurrentGroupAction(formData);
      setGroupDialogOpen(false);
      router.refresh();
    } finally {
      setSwitchingGroupId(null);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <section className="relative rounded-2xl border border-slate-200 bg-white p-5">
        <button
          type="button"
          className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full text-slate-700 transition-colors hover:bg-slate-100 active:bg-slate-200"
          aria-label="계정 설정 열기"
          onClick={() => {
            setProfileState(profileInitialState);
            setAvatarState(avatarInitialState);
            setProfileDialogOpen(true);
          }}
        >
          <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
            <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.04.04a2.1 2.1 0 0 1-2.98 2.98l-.04-.04a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.1 1.66V21a2.1 2.1 0 0 1-4.2 0v-.06a1.8 1.8 0 0 0-1.1-1.66 1.8 1.8 0 0 0-1.98.36l-.04.04a2.1 2.1 0 1 1-2.98-2.98l.04-.04A1.8 1.8 0 0 0 4.6 15a1.8 1.8 0 0 0-1.66-1.1H2.9a2.1 2.1 0 0 1 0-4.2h.04A1.8 1.8 0 0 0 4.6 8a1.8 1.8 0 0 0-.36-1.98L4.2 5.98A2.1 2.1 0 0 1 7.18 3l.04.04A1.8 1.8 0 0 0 9.2 3.4 1.8 1.8 0 0 0 10.3 1.74V1.7a2.1 2.1 0 0 1 4.2 0v.04A1.8 1.8 0 0 0 15.6 3.4a1.8 1.8 0 0 0 1.98-.36l.04-.04a2.1 2.1 0 1 1 2.98 2.98l-.04.04A1.8 1.8 0 0 0 19.4 8c.12.42.56 1.1 1.66 1.1h.04a2.1 2.1 0 0 1 0 4.2h-.04A1.8 1.8 0 0 0 19.4 15Z" />
          </svg>
        </button>
        <div className="flex items-center gap-4 pr-10">
          <Avatar name={currentUser.name} imageUrl={currentUser.avatarUrl} size="lg" />
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-lg font-extrabold leading-6 text-slate-950">{currentUser.name}</p>
              <div className="ml-auto flex shrink-0 flex-wrap justify-end gap-1.5">
                {roles.map((role) => (
                  <Badge key={role} tone={getRoleBadgeTone(role)}>{getRoleLabel(role)}</Badge>
                ))}
              </div>
            </div>
            <p className="mt-0.5 text-xs font-semibold text-slate-400">@{currentUser.id}</p>
            <button
              type="button"
              className="mt-3 inline-flex max-w-full items-center gap-2 rounded-xl px-0 py-1 text-left text-base font-extrabold text-slate-950"
              onClick={() => setGroupDialogOpen(true)}
            >
              <svg aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span className="min-w-0 truncate">{currentGroup.name}</span>
              <svg aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      <MenuBlock
        title="결산"
        rows={[
          `이번 주 결산: ${settlement.status === "draft" ? "미확정" : "확정"}`,
          `최종 벌금 합계: ${finalFineTotal.toLocaleString()}원`,
          `입금 계좌: ${accountInfo.bankName} ${accountInfo.accountNumber}`,
        ]}
      />
      <MenuBlock
        title="통장"
        rows={[
          `최근 잔고 등록 ${bankRecords.length}건`,
          isTreasurer ? "통장 잔고 등록/관리 가능" : "통장 잔고 조회만 가능",
        ]}
      />
      {isAdmin && (
        <MenuBlock
          title="관리"
          rows={["시즌 관리", "주간 결산 관리", "계좌 정보 수정"]}
        />
      )}

      <AppDialog
        open={groupDialogOpen}
        title="그룹 전환"
        description="승인된 그룹만 표시됩니다."
        onClose={() => setGroupDialogOpen(false)}
        dismissOnBackdrop
        actions={[{ label: "닫기", onClick: () => setGroupDialogOpen(false) }]}
      >
        <div className="space-y-2">
          {approvedGroups.map(({ group, membership }) => {
            const selected = group.id === currentGroup.id;
            return (
              <button
                key={group.id}
                type="button"
                disabled={Boolean(switchingGroupId)}
                className={`flex min-h-12 w-full items-center justify-between rounded-2xl border px-4 text-left text-sm font-extrabold ${
                  selected ? "border-[#DDD8F1] bg-[#F7F5FF] text-[#51438f]" : "border-slate-200 bg-white text-slate-800"
                } disabled:opacity-60`}
                onClick={() => handleGroupSwitch(group.id)}
              >
                <span className="truncate">{group.name}</span>
                <span className="ml-3 flex shrink-0 items-center gap-1.5">
                  {membership.roles.map((role) => (
                    <span key={role} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500">
                      {getRoleLabel(role)}
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </AppDialog>

      <AppDialog
        open={profileDialogOpen}
        title="계정 설정"
        onClose={() => setProfileDialogOpen(false)}
        dismissOnBackdrop
        footer={null}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
            <Avatar name={currentUser.name} imageUrl={currentUser.avatarUrl} size="md" />
            <button
              type="button"
              disabled={isAvatarRefreshing}
              className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-extrabold text-slate-950 disabled:text-slate-400"
              onClick={handleAvatarRefresh}
            >
              아바타 새로고침
            </button>
          </div>
          {avatarState.message && <p className={`text-xs font-bold ${avatarState.status === "error" ? "text-red-600" : "text-slate-500"}`}>{avatarState.message}</p>}
          <form onSubmit={handleProfileSubmit} className="space-y-3">
            <label className="block text-xs font-extrabold text-slate-500" htmlFor="profile-display-name">
              이름
            </label>
            <input
              id="profile-display-name"
              name="displayName"
              value={profileName}
              maxLength={20}
              onChange={(event) => setProfileName(event.target.value)}
              className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-[#5e4ea5]"
              required
            />
            {profileState.message && <p className={`text-xs font-bold ${profileState.status === "error" ? "text-red-600" : "text-slate-500"}`}>{profileState.message}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-950" onClick={() => setProfileDialogOpen(false)}>
                취소
              </button>
              <button type="submit" disabled={isProfileSubmitting || !profileName.trim()} className="min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-extrabold text-white disabled:bg-slate-200 disabled:text-slate-400">
                저장
              </button>
            </div>
          </form>
        </div>
      </AppDialog>
    </div>
  );
}
