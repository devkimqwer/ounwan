import type { ReactNode } from "react";

import type { Season } from "@/domain/models";
import { formatWeekday } from "./season-rule-options";


export function SeasonRulesSummary({ season }: { season: Season }) {
  return (
    <div className="space-y-2.5 text-sm font-semibold leading-6 text-slate-700">
      <p>
        한 주는 <SeasonRuleValue>{formatWeekday(season.weekStartDay)}</SeasonRuleValue>에 시작해요.
      </p>
      <p>
        하루는 <SeasonRuleValue>{formatTime(season.dayStartTime)}</SeasonRuleValue>부터 시작해요.
      </p>
      <p>
        하루에 여러 번 인증하면 <SeasonRuleValue>{formatDuplicatePolicy(season.dailyDuplicatePolicy)}</SeasonRuleValue> 인정해요.
      </p>
      <p>
        일주일에 최소 <SeasonRuleValue>{season.targetWorkoutCountPerWeek}회</SeasonRuleValue> 인증해야 해요.
      </p>
      <p>
        인증이 1회 부족할 때마다 <SeasonRuleValue>{formatCurrency(season.finePerMiss)}</SeasonRuleValue>의 벌금이 부과돼요.
      </p>
    </div>
  );
}

function SeasonRuleValue({ children }: { children: ReactNode }) {
  return <span className="inline-flex rounded-full bg-[#F7F5FF] px-2.5 py-1 text-sm font-extrabold text-[#51438f]">{children}</span>;
}


function formatTime(value: string) {
  return value.slice(0, 5);
}

function formatDuplicatePolicy(value: Season["dailyDuplicatePolicy"]) {
  return value === "count_all" ? "인증한 만큼" : "1회만";
}

function formatCurrency(value: number) {
  return value.toLocaleString("ko-KR") + "원";
}