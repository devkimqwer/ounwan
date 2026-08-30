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
  const hasMediaFile = formData
    .getAll("mediaFiles")
    .some((value) => value instanceof File && value.size > 0);

  if (!hasMediaFile) {
    return { status: "error", message: "사진 또는 영상을 1개 이상 선택해주세요." };
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
  });
  revalidatePath("/");

  return { status: "success", message: "운동 인증이 등록됐습니다." };
}

