"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { createGroupAction, type CreateGroupState } from "@/app/actions";

const initialState: CreateGroupState = { status: "idle", message: "" };

export function CreateGroupForm() {
  const [state, formAction] = useActionState(createGroupAction, initialState);

  return (
    <form action={formAction} className="mt-5 space-y-3">
      <label className="block text-sm font-extrabold text-slate-700" htmlFor="groupName">
        그룹명 <span className="text-red-500" aria-hidden="true">*</span>
      </label>
      <input
        id="groupName"
        name="groupName"
        maxLength={30}
        className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base font-bold text-slate-950 outline-none transition focus:border-[#5e4ea5] focus:ring-4 focus:ring-[#5e4ea5]/10"
        placeholder="예: 아침 운동 모임"
        required
      />
      {state.status === "error" && <p className="text-sm font-bold text-red-600">{state.message}</p>}
      <CreateGroupSubmitButton />
    </form>
  );
}

function CreateGroupSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 w-full rounded-xl bg-[#5e4ea5] px-4 text-base font-extrabold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "그룹 생성 중" : "그룹 생성하기"}
    </button>
  );
}