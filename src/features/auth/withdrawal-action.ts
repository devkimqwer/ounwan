"use server";

import { withdrawCurrentUser } from "@/auth/withdrawal";
import { AccountWithdrawalError } from "@/db/errors";

export async function withdrawAccountAction(): Promise<{ status: "success" | "error"; message: string }> {
  try {
    await withdrawCurrentUser();
    return { status: "success", message: "회원탈퇴가 완료됐습니다." };
  } catch (error) {
    if (error instanceof AccountWithdrawalError) {
      return { status: "error", message: error.message };
    }
    console.error("[ounwan withdrawal error]", error);
    return { status: "error", message: "회원탈퇴를 완료하지 못했습니다. 잠시 후 다시 시도해주세요." };
  }
}
