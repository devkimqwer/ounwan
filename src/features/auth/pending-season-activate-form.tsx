"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { activatePendingSeasonAction } from "@/app/actions";

export function PendingSeasonActivateForm() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleActivate = () => {
    setErrorMessage("");

    startTransition(async () => {
      const result = await activatePendingSeasonAction();
      if (result.status === "error") {
        setErrorMessage(result.message);
        return;
      }

      router.refresh();
    });
  };

  return (
    <div className="mt-3">
      {errorMessage && <p className="mb-2 text-xs font-bold text-red-600">{errorMessage}</p>}
      <button
        type="button"
        disabled={isPending}
        className="min-h-11 w-full rounded-xl bg-slate-950 px-4 text-sm font-extrabold text-white active:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400"
        onClick={handleActivate}
      >
        {isPending ? "시즌 시작 중" : "시즌 시작하기"}
      </button>
    </div>
  );
}