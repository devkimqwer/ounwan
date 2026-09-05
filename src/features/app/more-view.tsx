import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { refreshCurrentUserAvatarAction, switchCurrentGroupAction, updateCurrentUserProfileAction } from "@/app/actions";
import type { RefreshCurrentUserAvatarState, UpdateCurrentUserProfileState } from "@/app/actions";
import { AppDialog } from "@/components/ui/app-dialog";
import type { AccountInfo, AdminGroupMember, Group, Season, SeasonParticipant, User, UserGroupMembership } from "@/domain/models";
import { TextLogoutButton } from "@/features/auth/logout-controls";
import type { MoreSubPage } from "./app-types";
import { GroupMemberManagementView } from "./group-member-management-view";
import { SeasonManagementView } from "./season-management-view";
import { Avatar, Badge, getDisplayRoles, getRoleBadgeTone, getRoleLabel, MenuBlock } from "./shared-ui";

export function MoreView({
  isAdmin,
  isTreasurer,
  currentUser,
  currentGroup,
  approvedGroups,
  accountInfo,
  adminGroupMembers,
  seasons,
  seasonParticipants,
  activeMorePage,
  onOpenMorePage,
  onCloseMorePage,
}: {
  isAdmin: boolean;
  isTreasurer: boolean;
  currentUser: User;
  currentGroup: Group;
  approvedGroups: UserGroupMembership[];
  accountInfo: AccountInfo;
  adminGroupMembers: AdminGroupMember[];
  seasons: Season[];
  seasonParticipants: SeasonParticipant[];
  activeMorePage: MoreSubPage;
  onOpenMorePage: (page: Exclude<MoreSubPage, "main">) => void;
  onCloseMorePage: () => void;
}) {
  const router = useRouter();
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
  const [notReadyTitle, setNotReadyTitle] = useState<string | null>(null);

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

  const openNotReadyDialog = (title: string) => {
    setNotReadyTitle(title);
  };

  if (activeMorePage === "season-management") {
    return <SeasonManagementView seasons={seasons} seasonParticipants={seasonParticipants} onBack={onCloseMorePage} />;
  }

  if (activeMorePage === "group-member-management") {
    return <GroupMemberManagementView members={adminGroupMembers} onBack={onCloseMorePage} />;
  }

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
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
            <circle cx="12" cy="12" r="3" />
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
        title="벌금 입금 계좌"
        rows={[
          <MoreInfoRow key="bank-name" label="은행" value={accountInfo.bankName} />,
          <MoreInfoRow key="holder-name" label="예금주" value={accountInfo.holderName} />,
          <MoreInfoRow key="account-number" label="계좌번호" value={accountInfo.accountNumber} />,
        ]}
      />

      <MenuBlock
        rows={[
          <MoreMenuRow key="settlement-history" label="결산 내역" onClick={() => openNotReadyDialog("결산 내역")} />,
          <MoreMenuRow key="balance-status" label="잔고 현황" onClick={() => openNotReadyDialog("잔고 현황")} />,
          <MoreMenuRow key="season-archive" label="이전 시즌" onClick={() => openNotReadyDialog("이전 시즌")} />,
        ]}
      />

      <MenuBlock
        title="총무"
        rows={[
          <MoreMenuRow key="account-management" label="계좌 정보 관리" onClick={() => openNotReadyDialog("계좌 정보 관리")} />,
          <MoreMenuRow key="balance-registration" label="잔고 등록" onClick={() => openNotReadyDialog("잔고 등록")} />,
        ]}
      />

      {isAdmin && (
        <MenuBlock
          title="관리자"
          rows={[
            <MoreMenuRow key="season-management" label="시즌 관리" onClick={() => onOpenMorePage("season-management")} />,
            <MoreMenuRow key="settlement-management" label="결산 관리" onClick={() => openNotReadyDialog("결산 관리")} />,
            <MoreMenuRow key="member-management" label="그룹 멤버 관리" onClick={() => onOpenMorePage("group-member-management")} />,
          ]}
        />
      )}
      <div className="flex justify-center bg-slate-50 px-4 py-3">
        <TextLogoutButton />
      </div>

      <AppDialog
        open={Boolean(notReadyTitle)}
        title={notReadyTitle ?? "서비스 준비중"}
        description="서비스 준비중입니다."
        onClose={() => setNotReadyTitle(null)}
        dismissOnBackdrop
        actions={[{ label: "확인", onClick: () => setNotReadyTitle(null) }]}
      />
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
function MoreInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="shrink-0 font-extrabold text-slate-900">{label}</span>
      <span className="min-w-0 truncate text-right text-slate-700">{value}</span>
    </div>
  );
}

function MoreMenuRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="flex min-h-6 w-full items-center justify-between gap-4 text-left" onClick={onClick}>
      <span className="min-w-0 truncate">{label}</span>
      <svg
        aria-hidden="true"
        className="h-5 w-5 shrink-0 text-slate-300"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  );
}
