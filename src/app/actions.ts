"use server";

import { revalidatePath } from "next/cache";

import { createWorkoutPost } from "@/db/commands";

export type CreateWorkoutPostState = {
  status: "idle" | "success" | "error";
  message: string;
};

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

  if (mediaFiles.some((file) => !isSupportedMediaFile(file))) {
    return { status: "error", message: "이미지 또는 영상 파일만 업로드할 수 있습니다." };
  }

  if (!workoutType) {
    return { status: "error", message: "운동 종류를 입력해주세요." };
  }

  if (workoutType.length > 50) {
    return { status: "error", message: "운동 종류는 50자 이내로 입력해주세요." };
  }

  await createWorkoutPost({
    workoutType,
    content: content.length > 0 ? content : undefined,
    mediaFiles,
  });
  revalidatePath("/");

  return { status: "success", message: "운동 인증이 등록됐습니다." };
}

function isSupportedMediaFile(file: File) {
  return file.type.startsWith("image/") || file.type.startsWith("video/") || isPhoneMediaFile(file);
}

function isPhoneMediaFile(file: File) {
  return /\.(heic|heif|mov|m4v|mp4)$/i.test(file.name);
}
