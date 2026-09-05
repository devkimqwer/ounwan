"use server";

import { revalidatePath } from "next/cache";

import { createPostComment, createWorkoutPost, deletePostComment, deleteWorkoutPost, getOrCreateCurrentGroupInvite, refreshCurrentUserAvatar, switchCurrentGroup, togglePostLike, toggleWorkoutPostInvalid, updateCurrentUserProfile } from "@/db/commands";

const MAX_WORKOUT_POST_MEDIA_COUNT = 5;
const MAX_WORKOUT_POST_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_POST_COMMENT_LENGTH = 500;
const MAX_DISPLAY_NAME_LENGTH = 20;

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
