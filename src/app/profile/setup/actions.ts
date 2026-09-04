"use server";

import { redirect } from "next/navigation";

import { clearPendingKakaoId, getPendingKakaoId, setSessionUserId } from "@/auth/session";
import { registerKakaoUser } from "@/auth/users";

export type ProfileSetupState = {
  status: "idle" | "error";
  message: string;
};

export async function completeProfileSetupAction(
  _previousState: ProfileSetupState,
  formData: FormData,
): Promise<ProfileSetupState> {
  const displayName = String(formData.get("displayName") ?? "").trim();

  if (!displayName) {
    return { status: "error", message: "이름을 입력해주세요." };
  }

  if (displayName.length > 20) {
    return { status: "error", message: "이름은 20자 이내로 입력해주세요." };
  }

  const kakaoId = await getPendingKakaoId();
  if (!kakaoId) {
    return { status: "error", message: "카카오 연동 정보가 만료됐습니다. 다시 로그인해주세요." };
  }

  const userId = await registerKakaoUser({ kakaoId, displayName });
  await setSessionUserId(userId);
  await clearPendingKakaoId();
  redirect("/");
}