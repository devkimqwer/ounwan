"use client";

import { useActionState } from "react";

import type { ProfileSetupState } from "./actions";
import { completeProfileSetupAction } from "./actions";

const initialState: ProfileSetupState = { status: "idle", message: "" };

export function ProfileSetupForm() {
  const [state, formAction, isPending] = useActionState(completeProfileSetupAction, initialState);

  return (
    <form action={formAction} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
      <div>
        <h1 className="text-lg font-extrabold text-slate-950">회원 정보 설정</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">오운완에서 사용할 이름을 입력해주세요.</p>
      </div>
      <label className="block space-y-2">
        <span className="text-sm font-bold text-slate-700">이름 <span className="text-red-500">*</span></span>
        <input
          name="displayName"
          maxLength={20}
          className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-semibold outline-none placeholder:text-slate-400 focus:border-[#5e4ea5]"
          placeholder="예: 홍길동"
          autoComplete="name"
          required
        />
      </label>
      {state.status === "error" && state.message && (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{state.message}</p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="min-h-12 w-full rounded-2xl bg-slate-950 px-4 text-base font-extrabold text-white disabled:bg-slate-300"
      >
        {isPending ? "저장 중" : "완료"}
      </button>
    </form>
  );
}