"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUserNotificationPage } from "@/db/queries";
import { activateCurrentGroupPendingSeason, closeActiveSeason, createGroup, createPostComment, createSeason, createWorkoutPost, deleteCurrentUserPushSubscription, deleteNotification, deletePendingSeason, deletePostComment, deleteWorkoutPost, deleteGroup, getOrCreateCurrentGroupInvite, leaveGroup, markNotificationsRead, regenerateCurrentGroupInvite, refreshCurrentUserAvatar, reviewGroupJoinRequest, saveCurrentUserPushSubscription, switchCurrentGroup, togglePostLike, toggleWorkoutPostInvalid, updateCurrentUserProfile } from "@/db/commands";
import { GroupLeaveDelegateNotFoundError, GroupLeaveRequiresDelegationError, PendingSeasonAlreadyExistsError, PendingSeasonNotFoundError, SeasonStartDateInPastError } from "@/db/errors";

const MAX_WORKOUT_POST_MEDIA_COUNT = 5;
const MAX_WORKOUT_POST_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_POST_COMMENT_LENGTH = 500;
const MAX_DISPLAY_NAME_LENGTH = 20;
const MAX_GROUP_NAME_LENGTH = 30;
const MAX_SEASON_NAME_LENGTH = 30;

export type CreateGroupState = {
  status: "idle" | "success" | "error";
  message: string;
};
export type UpdateCurrentUserProfileState = {
  status: "idle" | "success" | "error";
  message: string;
};

export type RefreshCurrentUserAvatarState = {
  status: "idle" | "success" | "error";
  message: string;
};

export type CreateWorkoutPostState = {
  status: "idle" | "success" | "error";
  message: string;
  postId?: string;
};

export type CreateSeasonState = {
  status: "idle" | "success" | "error";
  message: string;
};

export type SeasonCommandState = {
  status: "success" | "error";
  message: string;
};
export type CreateGroupInviteState = {
  status: "idle" | "success" | "error";
  message: string;
  invitePath?: string;
  expiresAt?: string;
};

export type CreatePostCommentState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function createGroupAction(
  _previousState: CreateGroupState,
  formData: FormData,
): Promise<CreateGroupState> {
  const validation = validateGroupName(formData);
  if (!validation.ok) {
    return validation.state;
  }

  await createGroup(validation.groupName);
  revalidatePath("/");
  redirect("/");
}

export async function createGroupInAppAction(formData: FormData): Promise<CreateGroupState> {
  const validation = validateGroupName(formData);
  if (!validation.ok) {
    return validation.state;
  }

  try {
    await createGroup(validation.groupName);
    revalidatePath("/");
    return { status: "success", message: "그룹이 생성됐습니다." };
  } catch {
    return { status: "error", message: "그룹을 생성할 수 없습니다." };
  }
}

function validateGroupName(formData: FormData): { ok: true; groupName: string } | { ok: false; state: CreateGroupState } {
  const groupName = String(formData.get("groupName") ?? "").trim();

  if (!groupName) {
    return { ok: false, state: { status: "error", message: "그룹명을 입력해주세요." } };
  }

  if (groupName.length > MAX_GROUP_NAME_LENGTH) {
    return { ok: false, state: { status: "error", message: `그룹명은 ${MAX_GROUP_NAME_LENGTH}자 이내로 입력해주세요.` } };
  }

  return { ok: true, groupName };
}

export async function createSeasonAction(
  _previousState: CreateSeasonState,
  formData: FormData,
): Promise<CreateSeasonState> {
  const name = String(formData.get("name") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "").trim();
  const targetWorkoutCountPerWeek = Number(formData.get("targetWorkoutCountPerWeek"));
  const finePerMiss = Number(formData.get("finePerMiss"));

  if (!name) {
    return { status: "error", message: "시즌명을 입력해주세요." };
  }

  if (name.length > MAX_SEASON_NAME_LENGTH) {
    return { status: "error", message: `시즌명은 ${MAX_SEASON_NAME_LENGTH}자 이내로 입력해주세요.` };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return { status: "error", message: "시작일을 선택해주세요." };
  }

  if (startDate < getKoreanDate()) {
    return { status: "error", message: "시작일은 오늘 또는 이후 일자로 선택해주세요." };
  }

  if (!Number.isInteger(targetWorkoutCountPerWeek) || targetWorkoutCountPerWeek < 1 || targetWorkoutCountPerWeek > 7) {
    return { status: "error", message: "주간 목표는 1~7회로 입력해주세요." };
  }

  if (!Number.isInteger(finePerMiss) || finePerMiss < 0) {
    return { status: "error", message: "벌금은 0원 이상으로 입력해주세요." };
  }

  try {
    await createSeason({ name, startDate, targetWorkoutCountPerWeek, finePerMiss });
    revalidatePath("/");
    return { status: "success", message: "시즌이 생성됐습니다." };
  } catch (error) {
    if (error instanceof PendingSeasonAlreadyExistsError) {
      return { status: "error", message: "이미 대기중인 시즌이 있습니다." };
    }

    if (error instanceof SeasonStartDateInPastError) {
      return { status: "error", message: "시작일은 오늘 또는 이후 일자로 선택해주세요." };
    }

    console.error("[ounwan error]", error);

    return { status: "error", message: "시즌을 생성할 수 없습니다." };
  }
}
export async function activatePendingSeasonAction(): Promise<SeasonCommandState> {
  try {
    await activateCurrentGroupPendingSeason();
    revalidatePath("/");
    return { status: "success", message: "대기중 시즌이 시작됐습니다." };
  } catch (error) {
    if (error instanceof PendingSeasonNotFoundError) {
      return { status: "error", message: "대기중인 시즌이 없습니다." };
    }


    return { status: "error", message: "대기중 시즌을 시작할 수 없습니다." };
  }
}
export async function closeSeasonAction(formData: FormData): Promise<SeasonCommandState> {
  const seasonId = String(formData.get("seasonId") ?? "").trim();
  const activatePendingSeason = formData.get("activatePendingSeason") === "true";

  if (!seasonId) {
    return { status: "error", message: "시즌 정보를 확인할 수 없습니다." };
  }

  try {
    await closeActiveSeason({ seasonId, activatePendingSeason });
    revalidatePath("/");
    return { status: "success", message: "시즌이 종료됐습니다." };
  } catch {
    return { status: "error", message: "시즌을 종료할 수 없습니다." };
  }
}

export async function deletePendingSeasonAction(formData: FormData): Promise<SeasonCommandState> {
  const seasonId = String(formData.get("seasonId") ?? "").trim();

  if (!seasonId) {
    return { status: "error", message: "시즌 정보를 확인할 수 없습니다." };
  }

  try {
    await deletePendingSeason(seasonId);
    revalidatePath("/");
    return { status: "success", message: "대기중 시즌이 삭제됐습니다." };
  } catch {
    return { status: "error", message: "대기중 시즌을 삭제할 수 없습니다." };
  }
}

export async function createGroupInviteAction(): Promise<CreateGroupInviteState> {
  try {
    const invite = await getOrCreateCurrentGroupInvite();
    revalidatePath("/");

    return {
      status: "success",
      message: "초대 링크가 생성됐습니다.",
      invitePath: invite.invitePath,
      expiresAt: invite.expiresAt,
    };
  } catch {
    return { status: "error", message: "초대 링크를 생성할 수 없습니다." };
  }
}

export async function regenerateGroupInviteAction(): Promise<CreateGroupInviteState> {
  try {
    const invite = await regenerateCurrentGroupInvite();
    revalidatePath("/");

    return {
      status: "success",
      message: "새 초대 링크가 발급됐습니다.",
      invitePath: invite.invitePath,
      expiresAt: invite.expiresAt,
    };
  } catch {
    return { status: "error", message: "초대 링크를 새로 발급할 수 없습니다." };
  }
}

export async function updateCurrentUserProfileAction(
  _previousState: UpdateCurrentUserProfileState,
  formData: FormData,
): Promise<UpdateCurrentUserProfileState> {
  const displayName = String(formData.get("displayName") ?? "").trim();

  if (!displayName) {
    return { status: "error", message: "이름을 입력해주세요." };
  }

  if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    return { status: "error", message: `이름은 ${MAX_DISPLAY_NAME_LENGTH}자 이내로 입력해주세요.` };
  }

  await updateCurrentUserProfile(displayName);
  revalidatePath("/");

  return { status: "success", message: "이름이 변경됐습니다." };
}

export async function refreshCurrentUserAvatarAction(
  _previousState: RefreshCurrentUserAvatarState,
): Promise<RefreshCurrentUserAvatarState> {
  try {
    await refreshCurrentUserAvatar();
    revalidatePath("/");
    return { status: "success", message: "아바타가 새로고침됐습니다." };
  } catch {
    return { status: "error", message: "아바타 새로고침 중 문제가 발생했습니다." };
  }
}

export async function switchCurrentGroupAction(formData: FormData) {
  const groupId = String(formData.get("groupId") ?? "").trim();

  if (!groupId) {
    throw new Error("groupId is required.");
  }

  await switchCurrentGroup(groupId);
  revalidatePath("/");
}

export type LeaveGroupState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function leaveGroupAction(formData: FormData): Promise<LeaveGroupState> {
  const groupId = String(formData.get("groupId") ?? "").trim();
  const delegateUserId = String(formData.get("delegateUserId") ?? "").trim() || undefined;

  if (!groupId) {
    return { status: "error", message: "그룹 정보를 확인할 수 없습니다." };
  }

  try {
    await leaveGroup({ groupId, delegateUserId });
    revalidatePath("/");
    return { status: "success", message: "그룹에서 나갔습니다." };
  } catch (error) {
    if (error instanceof GroupLeaveRequiresDelegationError) {
      return { status: "error", message: "관리자는 다른 멤버에게 권한을 위임해야 그룹에서 나갈 수 있습니다." };
    }

    if (error instanceof GroupLeaveDelegateNotFoundError) {
      return { status: "error", message: "위임할 멤버를 확인할 수 없습니다." };
    }

    return { status: "error", message: "그룹에서 나갈 수 없습니다." };
  }
}


export type DeleteGroupState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function deleteGroupAction(formData: FormData): Promise<DeleteGroupState> {
  const groupId = String(formData.get("groupId") ?? "").trim();

  if (!groupId) {
    return { status: "error", message: "그룹 정보를 확인할 수 없습니다." };
  }

  try {
    await deleteGroup({ groupId });
    revalidatePath("/");
    return { status: "success", message: "그룹이 삭제됐습니다." };
  } catch {
    return { status: "error", message: "그룹을 삭제할 수 없습니다." };
  }
}
export async function reviewGroupJoinRequestAction(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();

  if (!requestId) {
    throw new Error("requestId is required.");
  }

  if (decision !== "approve" && decision !== "reject") {
    throw new Error("Invalid join request decision.");
  }

  await reviewGroupJoinRequest(requestId, decision);
  revalidatePath("/");
}

export async function createPostCommentAction(
  _previousState: CreatePostCommentState,
  formData: FormData,
): Promise<CreatePostCommentState> {
  const postId = String(formData.get("postId") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();

  if (!postId) {
    return { status: "error", message: "게시글 정보를 확인할 수 없습니다." };
  }

  if (!content) {
    return { status: "error", message: "댓글을 입력해주세요." };
  }

  if (content.length > MAX_POST_COMMENT_LENGTH) {
    return { status: "error", message: `댓글은 ${MAX_POST_COMMENT_LENGTH}자 이내로 입력해주세요.` };
  }

  await createPostComment(postId, content);
  revalidatePath("/");

  return { status: "success", message: "댓글이 등록됐습니다." };
}


export async function deletePostCommentAction(formData: FormData) {
  const commentId = String(formData.get("commentId") ?? "").trim();

  if (!commentId) {
    throw new Error("commentId is required.");
  }

  await deletePostComment(commentId);
  revalidatePath("/");
}
export async function togglePostLikeAction(formData: FormData) {
  const postId = String(formData.get("postId") ?? "").trim();

  if (!postId) {
    throw new Error("postId is required.");
  }

  await togglePostLike(postId);
  revalidatePath("/");
}


export async function loadNotificationsAction(offset: number) {
  return getCurrentUserNotificationPage(offset);
}

export async function markNotificationsReadAction(notificationIds: string[]) {
  await markNotificationsRead(notificationIds);
  revalidatePath("/");
}

export async function deleteNotificationAction(notificationId: string) {
  await deleteNotification(notificationId);
  revalidatePath("/");
}

type BrowserPushSubscription = {
  endpoint?: unknown;
  keys?: {
    p256dh?: unknown;
    auth?: unknown;
  };
};

export async function savePushSubscriptionAction(subscription: BrowserPushSubscription, userAgent?: string) {
  const endpoint = typeof subscription.endpoint === "string" ? subscription.endpoint : "";
  const p256dh = typeof subscription.keys?.p256dh === "string" ? subscription.keys.p256dh : "";
  const auth = typeof subscription.keys?.auth === "string" ? subscription.keys.auth : "";

  await saveCurrentUserPushSubscription({
    endpoint,
    p256dh,
    auth,
    userAgent,
  });
}

export async function deletePushSubscriptionAction(endpoint: string) {
  await deleteCurrentUserPushSubscription(endpoint);
}

export async function getPushNotificationPublicKeyAction() {
  return process.env.OUNWAN_VAPID_PUBLIC_KEY?.trim() ?? "";
}

export async function toggleWorkoutPostInvalidAction(formData: FormData) {
  const postId = String(formData.get("postId") ?? "").trim();

  if (!postId) {
    throw new Error("postId is required.");
  }

  await toggleWorkoutPostInvalid(postId);
  revalidatePath("/");
}

export async function deleteWorkoutPostAction(formData: FormData) {
  const postId = String(formData.get("postId") ?? "").trim();

  if (!postId) {
    throw new Error("postId is required.");
  }

  await deleteWorkoutPost(postId);
  revalidatePath("/");
}

export async function createWorkoutPostAction(
  _previousState: CreateWorkoutPostState,
  formData: FormData,
): Promise<CreateWorkoutPostState> {
  const workoutType = String(formData.get("workoutType") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const mediaFiles = formData
    .getAll("mediaFiles")
    .filter((value): value is File => value instanceof File && value.size > 0);
  const hasMediaFile = mediaFiles.length > 0;

  if (!hasMediaFile) {
    return { status: "error", message: "사진 또는 영상을 1개 이상 선택해주세요." };
  }

  if (mediaFiles.length > MAX_WORKOUT_POST_MEDIA_COUNT) {
    return { status: "error", message: "사진 또는 영상은 최대 5개까지 등록할 수 있습니다." };
  }

  if (getTotalFileSize(mediaFiles) > MAX_WORKOUT_POST_UPLOAD_BYTES) {
    return { status: "error", message: "사진 또는 영상은 총 5MB 이하로 선택해주세요." };
  }

  if (mediaFiles.some((file) => !isSupportedMediaFile(file))) {
    return { status: "error", message: "이미지 또는 영상 파일만 업로드할 수 있습니다." };
  }

  if (workoutType.length > 50) {
    return { status: "error", message: "운동 종류는 50자 이내로 입력해주세요." };
  }

  const post = await createWorkoutPost({
    workoutType: workoutType.length > 0 ? workoutType : undefined,
    content: content.length > 0 ? content : undefined,
    mediaFiles,
  });
  revalidatePath("/");

  return { status: "success", message: "운동 인증이 등록됐습니다.", postId: post.id };
}

function getTotalFileSize(files: File[]) {
  return files.reduce((total, file) => total + file.size, 0);
}

function isSupportedMediaFile(file: File) {
  return file.type.startsWith("image/") || file.type.startsWith("video/") || isPhoneMediaFile(file);
}

function isPhoneMediaFile(file: File) {
  return /\.(heic|heif|mov|m4v|mp4)$/i.test(file.name);
}

function getKoreanDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
