"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { createSeasonAction, type CreateSeasonState } from "@/app/actions";

const initialState: CreateSeasonState = { status: "idle", message: "" };

export function SeasonCreateForm({ onCreated }: { onCreated?: () => void }) {
  const router = useRouter();
  const [state, formAction] = useActionState(createSeasonAction, initialState);

  useEffect(() => {
    if (state.status !== "success") {
      return;
    }

    onCreated?.();
    router.refresh();
  }, [onCreated, router, state.status]);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block space-y-2">
        <span className="text-sm font-extrabold text-slate-700">시즌명</span>
        <input
          name="name"
          maxLength={30}
          className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base font-bold text-slate-950 outline-none transition focus:border-[#5e4ea5] focus:ring-4 focus:ring-[#5e4ea5]/10"
          placeholder="예: 2026 시즌 4"
          required
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-extrabold text-slate-700">시작예정일</span>
        <div className="text-xs text-red-700">※ 활성화된 시즌이 없는 경우에만 지정된 일자에 자동으로 시즌이 활성화 됩니다.</div>
        <input
          type="date"
          name="startDate"
          defaultValue={getTodayDate()}
          min={getTodayDate()}
          className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base font-bold text-slate-950 outline-none transition focus:border-[#5e4ea5] focus:ring-4 focus:ring-[#5e4ea5]/10"
          required
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-2">
          <span className="text-sm font-extrabold text-slate-700">주간 목표 (인증 횟수)</span>
          <input
            type="number"
            name="targetWorkoutCountPerWeek"
            min={1}
            max={7}
            className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base font-bold text-slate-950 outline-none transition focus:border-[#5e4ea5] focus:ring-4 focus:ring-[#5e4ea5]/10"
            required
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-extrabold text-slate-700">벌금 (단위: 원)</span>
          <input
            type="number"
            name="finePerMiss"
            min={0}
            step={1000}
            className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base font-bold text-slate-950 outline-none transition focus:border-[#5e4ea5] focus:ring-4 focus:ring-[#5e4ea5]/10"
            required
          />
        </label>
      </div>

      {state.status !== "idle" && (
        <p className={`text-sm font-bold ${state.status === "success" ? "text-[#51438f]" : "text-red-600"}`}>{state.message}</p>
      )}

      <SeasonCreateSubmitButton />
    </form>
  );
}

function SeasonCreateSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 w-full rounded-xl bg-slate-950 px-4 text-sm font-extrabold text-white active:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400"
    >
      {pending ? "생성 중" : "시즌 생성"}
    </button>
  );
}

function getTodayDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}