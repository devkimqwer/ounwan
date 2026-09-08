import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createGroupInAppAction, deleteGroupAction, leaveGroupAction, refreshCurrentUserAvatarAction, switchCurrentGroupAction, updateCurrentUserProfileAction } from "@/app/actions";
import type { CreateGroupState, DeleteGroupState, LeaveGroupState, RefreshCurrentUserAvatarState, UpdateCurrentUserProfileState } from "@/app/actions";
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
  const groupCreateInitialState: CreateGroupState = { status: "idle", message: "" };
  const leaveGroupInitialState: LeaveGroupState = { status: "idle", message: "" };
  const deleteGroupInitialState: DeleteGroupState = { status: "idle", message: "" };
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupCreateOpen, setGroupCreateOpen] = useState(false);
  const [groupCreateName, setGroupCreateName] = useState("");
  const [groupCreateState, setGroupCreateState] = useState<CreateGroupState>(groupCreateInitialState);
  const [isGroupCreating, setIsGroupCreating] = useState(false);
  const [groupActionTarget, setGroupActionTarget] = useState<UserGroupMembership | null>(null);
  const [leaveGroupTarget, setLeaveGroupTarget] = useState<UserGroupMembership | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<UserGroupMembership | null>(null);
  const [leaveGroupDialogOpen, setLeaveGroupDialogOpen] = useState(false);
  const [leaveDelegateUserId, setLeaveDelegateUserId] = useState("");
  const [leaveGroupState, setLeaveGroupState] = useState<LeaveGroupState>(leaveGroupInitialState);
  const [isLeavingGroup, setIsLeavingGroup] = useState(false);
  const [deleteGroupState, setDeleteGroupState] = useState<DeleteGroupState>(deleteGroupInitialState);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
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

  const handleGroupCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isGroupCreating) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    setGroupCreateState(groupCreateInitialState);
    setIsGroupCreating(true);

    try {
      const result = await createGroupInAppAction(formData);
      setGroupCreateState(result);
      if (result.status === "success") {
        setGroupCreateName("");
        setGroupCreateOpen(false);
        setGroupDialogOpen(false);
        router.refresh();
      }
    } catch {
      setGroupCreateState({ status: "error", message: "그룹을 생성할 수 없습니다." });
    } finally {
      setIsGroupCreating(false);
    }
  };

  const openLeaveGroupDialog = (target: UserGroupMembership) => {
    setGroupActionTarget(null);
    setLeaveGroupTarget(target);
    setLeaveGroupState(leaveGroupInitialState);
    setLeaveDelegateUserId(target.leaveDelegateCandidates?.[0]?.id ?? "");
    setLeaveGroupDialogOpen(true);
  };


  const openDeleteGroupDialog = (target: UserGroupMembership) => {
    setGroupActionTarget(null);
    setDeleteGroupTarget(target);
    setDeleteGroupState(deleteGroupInitialState);
  };
  const handleLeaveGroupSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLeavingGroup) {
      return;
    }

    const target = leaveGroupTarget;
    if (!target) {
      setLeaveGroupState({ status: "error", message: "그룹 정보를 확인할 수 없습니다." });
      return;
    }

    const isTargetAdmin = target.membership.roles.includes("admin");
    if (isTargetAdmin && !leaveDelegateUserId) {
      setLeaveGroupState({ status: "error", message: "위임할 멤버를 선택해주세요." });
      return;
    }

    const formData = new FormData(event.currentTarget);
    formData.set("groupId", target.group.id);
    setLeaveGroupState(leaveGroupInitialState);
    setIsLeavingGroup(true);

    try {
      const result = await leaveGroupAction(formData);
      setLeaveGroupState(result);
      if (result.status === "success") {
        setLeaveGroupDialogOpen(false);
        setLeaveGroupTarget(null);
        setGroupDialogOpen(false);
        router.refresh();
      }
    } catch {
      setLeaveGroupState({ status: "error", message: "그룹에서 나갈 수 없습니다." });
    } finally {
      setIsLeavingGroup(false);
    }
  };


  const handleDeleteGroupSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isDeletingGroup) {
      return;
    }

    const target = deleteGroupTarget;
    if (!target) {
      setDeleteGroupState({ status: "error", message: "그룹 정보를 확인할 수 없습니다." });
      return;
    }

    const formData = new FormData(event.currentTarget);
    formData.set("groupId", target.group.id);
    setDeleteGroupState(deleteGroupInitialState);
    setIsDeletingGroup(true);

    try {
      const result = await deleteGroupAction(formData);
      setDeleteGroupState(result);
      if (result.status === "success") {
        setDeleteGroupTarget(null);
        setGroupDialogOpen(false);
        router.refresh();
      }
    } catch {
      setDeleteGroupState({ status: "error", message: "그룹을 삭제할 수 없습니다." });
    } finally {
      setIsDeletingGroup(false);
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
              onClick={() => {
                setGroupCreateState(groupCreateInitialState);
                setGroupCreateOpen(false);
                setGroupDialogOpen(true);
              }}
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

      {isTreasurer && (
        <MenuBlock
          title="총무"
          rows={[
            <MoreMenuRow key="account-management" label="계좌 정보 관리" onClick={() => openNotReadyDialog("계좌 정보 관리")} />,
            <MoreMenuRow key="balance-registration" label="잔고 등록" onClick={() => openNotReadyDialog("잔고 등록")} />,
          ]}
        />
      )}

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
          {approvedGroups.map((membershipItem) => {
            const { group, membership } = membershipItem;
            const selected = group.id === currentGroup.id;
            return (
              <div
                key={group.id}
                className={`flex min-h-14 items-center gap-2 rounded-2xl border px-3 py-2 ${
                  selected ? "border-[#DDD8F1] bg-[#F7F5FF] text-[#51438f]" : "border-slate-200 bg-white text-slate-800"
                }`}
              >
                <button
                  type="button"
                  disabled={Boolean(switchingGroupId) || isGroupCreating || isLeavingGroup || isDeletingGroup}
                  className="min-w-0 flex-1 text-left disabled:opacity-60"
                  onClick={() => handleGroupSwitch(group.id)}
                >
                  <span className="block truncate text-sm font-extrabold">{group.name}</span>
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    {membership.roles.map((role) => (
                      <span key={role} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500">
                        {getRoleLabel(role)}
                      </span>
                    ))}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={Boolean(switchingGroupId) || isGroupCreating || isLeavingGroup || isDeletingGroup}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-500 active:bg-slate-100 disabled:opacity-40"
                  aria-label={`${group.name} 그룹 메뉴 열기`}
                  onClick={() => setGroupActionTarget(membershipItem)}
                >
                  <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="1" />
                    <circle cx="19" cy="12" r="1" />
                    <circle cx="5" cy="12" r="1" />
                  </svg>
                </button>
              </div>
            );
          })}

          <div className="space-y-3 border-t border-slate-100 pt-3">
            {groupCreateOpen ? (
              <form className="space-y-3" onSubmit={handleGroupCreateSubmit}>
                <label className="block text-xs font-extrabold text-slate-500" htmlFor="more-group-name">
                  새 그룹명
                </label>
                <input
                  id="more-group-name"
                  name="groupName"
                  value={groupCreateName}
                  maxLength={30}
                  onChange={(event) => setGroupCreateName(event.target.value)}
                  className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-[#5e4ea5]"
                  placeholder="예: 아침 운동 모임"
                  required
                />
                {groupCreateState.status === "error" && <p className="text-xs font-bold text-red-600">{groupCreateState.message}</p>}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isGroupCreating}
                    className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-950 disabled:bg-slate-100 disabled:text-slate-400"
                    onClick={() => {
                      setGroupCreateOpen(false);
                      setGroupCreateState(groupCreateInitialState);
                    }}
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={isGroupCreating || !groupCreateName.trim()}
                    className="min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-extrabold text-white disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    {isGroupCreating ? "생성 중" : "그룹 생성"}
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 text-sm font-extrabold text-slate-700 active:bg-slate-50"
                onClick={() => {
                  setGroupCreateState(groupCreateInitialState);
                  setGroupCreateOpen(true);
                }}
              >
                <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
                새 그룹 만들기
              </button>
            )}
          </div>
        </div>
      </AppDialog>

      <GroupActionMenuDialog
        target={groupActionTarget}
        onLeave={openLeaveGroupDialog}
        onDelete={openDeleteGroupDialog}
        onClose={() => setGroupActionTarget(null)}
      />
      <DeleteGroupDialog
        target={deleteGroupTarget}
        state={deleteGroupState}
        submitting={isDeletingGroup}
        onSubmit={handleDeleteGroupSubmit}
        onClose={() => setDeleteGroupTarget(null)}
      />
      <LeaveGroupDialog
        open={leaveGroupDialogOpen}
        target={leaveGroupTarget}
        delegateUserId={leaveDelegateUserId}
        state={leaveGroupState}
        submitting={isLeavingGroup}
        onDelegateChange={setLeaveDelegateUserId}
        onSubmit={handleLeaveGroupSubmit}
        onClose={() => {
          setLeaveGroupDialogOpen(false);
          setLeaveGroupTarget(null);
        }}
      />
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
function GroupActionMenuDialog({
  target,
  onLeave,
  onDelete,
  onClose,
}: {
  target: UserGroupMembership | null;
  onLeave: (target: UserGroupMembership) => void;
  onDelete: (target: UserGroupMembership) => void;
  onClose: () => void;
}) {
  const isAdmin = target?.membership.roles.includes("admin") ?? false;

  return (
    <AppDialog
      open={Boolean(target)}
      title={target?.group.name ?? "그룹 메뉴"}
      onClose={onClose}
      dismissOnBackdrop
      footer={null}
    >
      {target && (
        <div className="space-y-2">
          <button
            type="button"
            className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-extrabold text-slate-900 active:bg-slate-50"
            onClick={() => onLeave(target)}
          >
            <svg aria-hidden="true" className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="m16 17 5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
            그룹 나가기
          </button>
          {isAdmin && (
            <button
              type="button"
              className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-extrabold text-slate-900 active:bg-slate-50"
              onClick={() => onDelete(target)}
            >
              <svg aria-hidden="true" className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="M19 6l-1 14H6L5 6" />
              </svg>
              그룹 삭제
            </button>
          )}
        </div>
      )}
    </AppDialog>
  );
}

function DeleteGroupDialog({
  target,
  state,
  submitting,
  onSubmit,
  onClose,
}: {
  target: UserGroupMembership | null;
  state: DeleteGroupState;
  submitting: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  return (
    <AppDialog
      open={Boolean(target)}
      title="그룹 삭제"
      description={target ? `${target.group.name} 그룹을 삭제하시겠습니까?` : undefined}
      onClose={onClose}
      dismissOnBackdrop={!submitting}
      role="alertdialog"
      footer={null}
    >
      <form className="space-y-3" onSubmit={onSubmit}>
        <input type="hidden" name="groupId" value={target?.group.id ?? ""} />
        <div className="rounded-2xl border border-red-100 bg-red-50 p-3">
          <p className="text-sm font-bold leading-5 text-red-700">
            삭제된 그룹은 목록에서 사라지고 기존 초대 링크와 대기 요청은 더 이상 사용할 수 없습니다.
          </p>
        </div>
        {state.message && <p className={`text-sm font-bold ${state.status === "error" ? "text-red-600" : "text-slate-500"}`}>{state.message}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            disabled={submitting}
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-950 disabled:bg-slate-100 disabled:text-slate-400"
            onClick={onClose}
          >
            취소
          </button>
          <button
            type="submit"
            disabled={submitting || !target}
            className="min-h-11 rounded-xl bg-red-500 px-4 text-sm font-extrabold text-white disabled:bg-slate-200 disabled:text-slate-400"
          >
            {submitting ? "처리 중" : "삭제"}
          </button>
        </div>
      </form>
    </AppDialog>
  );
}
function LeaveGroupDialog({
  open,
  target,
  delegateUserId,
  state,
  submitting,
  onDelegateChange,
  onSubmit,
  onClose,
}: {
  open: boolean;
  target: UserGroupMembership | null;
  delegateUserId: string;
  state: LeaveGroupState;
  submitting: boolean;
  onDelegateChange: (userId: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  const isAdmin = target?.membership.roles.includes("admin") ?? false;
  const delegateCandidates = target?.leaveDelegateCandidates ?? [];
  const canLeave = Boolean(target) && (!isAdmin || delegateCandidates.length > 0);

  return (
    <AppDialog
      open={open}
      title="그룹 나가기"
      description={target ? `${target.group.name} 그룹에서 나가시겠습니까?` : undefined}
      onClose={onClose}
      dismissOnBackdrop={!submitting}
      role="alertdialog"
      footer={null}
    >
      <form className="space-y-3" onSubmit={onSubmit}>
        <input type="hidden" name="groupId" value={target?.group.id ?? ""} />
        {isAdmin && (
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3">
            <p className="text-sm font-bold leading-5 text-amber-800">
              관리자는 다른 멤버에게 관리자 권한을 위임해야 그룹에서 나갈 수 있습니다.
            </p>
            {delegateCandidates.length > 0 ? (
              <label className="mt-3 block text-xs font-extrabold text-amber-800" htmlFor="leave-delegate-user-id">
                위임할 멤버
                <select
                  id="leave-delegate-user-id"
                  name="delegateUserId"
                  value={delegateUserId}
                  onChange={(event) => onDelegateChange(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-xl border border-amber-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none"
                  required
                >
                  {delegateCandidates.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} (@{user.id})
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="mt-2 text-xs font-bold leading-5 text-amber-800">
                위임할 멤버가 없어 그룹에서 나갈 수 없습니다. 그룹 삭제 기능이 필요합니다.
              </p>
            )}
          </div>
        )}
        {state.message && <p className={`text-sm font-bold ${state.status === "error" ? "text-red-600" : "text-slate-500"}`}>{state.message}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            disabled={submitting}
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-950 disabled:bg-slate-100 disabled:text-slate-400"
            onClick={onClose}
          >
            취소
          </button>
          <button
            type="submit"
            disabled={submitting || !canLeave}
            className="min-h-11 rounded-xl bg-red-500 px-4 text-sm font-extrabold text-white disabled:bg-slate-200 disabled:text-slate-400"
          >
            {submitting ? "처리 중" : "나가기"}
          </button>
        </div>
      </form>
    </AppDialog>
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
