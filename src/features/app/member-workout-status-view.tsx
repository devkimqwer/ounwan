"use client";

import { useEffect, useState } from "react";

import { getMemberWorkoutStatusAction } from "@/app/actions";
import type { MemberWorkoutStatus } from "@/domain/models";
import { formatSystemMonthDay } from "@/lib/date-format";
import { AppSubPageHeader, Avatar } from "./shared-ui";
import { DailyWorkoutMark } from "./settlement-detail-ui";

const weekdayFormatter = new Intl.DateTimeFormat("ko-KR", { weekday: "short", timeZone: "Asia/Seoul" });

export function MemberWorkoutStatusView({ groupId, onBack }: { groupId: string; onBack: () => void }) {
  const [data, setData] = useState<MemberWorkoutStatus | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setData(null);
    setError(false);

    getMemberWorkoutStatusAction()
      .then((result) => {
        if (!active) {
          return;
        }

        if (result.groupId !== groupId) {
          setError(true);
          return;
        }

        setData(result);
      })
      .catch(() => {
        if (active) {
          setError(true);
        }
      });

    return () => {
      active = false;
    };
  }, [groupId, attempt]);

  return (
    <div className="min-h-full bg-slate-50 pb-6">
      <AppSubPageHeader title="멤버 인증 현황" onBack={onBack} />
      {error ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-slate-500" role="alert">인증 현황을 불러오지 못했습니다.</p>
          <button type="button" className="mt-4 min-h-11 px-4 text-sm font-semibold text-[#5e4ea5]" onClick={() => setAttempt((value) => value + 1)}>다시 시도</button>
        </div>
      ) : !data || data.groupId !== groupId ? (
        <p role="status" className="px-4 py-10 text-center text-sm text-slate-500">불러오는 중입니다.</p>
      ) : (
        <div className="space-y-4 p-4">
          <div>
            <h2 className="text-base font-bold text-slate-950">{data.seasonName ?? "진행 중인 시즌이 없습니다."}</h2>
            {data.days.length > 0 && <p className="mt-1 text-sm text-slate-500">{formatSystemMonthDay(data.days[0])} ~ {formatSystemMonthDay(data.days[data.days.length - 1])}</p>}
          </div>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-950">멤버</h3>
            <span className="text-xs text-slate-400">{data.members.length}명</span>
          </div>
          {data.members.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">멤버가 없습니다.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full border-collapse text-sm">
                <caption className="sr-only">멤버별 이번 주 인증 현황</caption>
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold text-slate-400">
                    <th scope="col" className="sticky left-0 z-[1] min-w-28 bg-slate-50 px-3 py-3 text-left">이름</th>
                    {data.days.map((day) => (
                      <th scope="col" key={day} aria-current={day === data.today ? "date" : undefined} className={`min-w-12 px-2 py-3 text-center ${day === data.today ? "bg-[#EDE8FA] text-[#5e4ea5]" : ""}`}>
                        <span className="block text-slate-600">{formatSystemMonthDay(day)}</span>
                        <span className="mt-0.5 block">({weekdayFormatter.format(new Date(`${day}T00:00:00+09:00`))})</span>
                      </th>
                    ))}
                    {data.days.length > 0 && <th scope="col" className="min-w-14 px-3 py-3 text-center">횟수</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.members.map((member) => {
                    const isCurrentUser = member.id === data.currentUserId;
                    const todayBackground = isCurrentUser ? "bg-[#E5DDF7]" : "bg-[#F2F0FA]";

                    return (
                      <tr key={member.id} className={`border-b border-slate-100 last:border-b-0 ${isCurrentUser ? "bg-[#F7F5FF]" : ""}`}>
                        <th scope="row" className={`sticky left-0 z-[1] px-3 py-3 text-left min-w-[130px] ${isCurrentUser ? "bg-[#F7F5FF]" : "bg-white"}`}>
                          <div className="flex items-center gap-2">
                            <Avatar name={member.name} imageUrl={member.avatarUrl} size="sm" />
                            <span className="max-w-24 break-words text-sm font-bold text-slate-950">{member.name}</span>
                            {isCurrentUser && <span className="shrink-0 rounded-full bg-[#5e4ea5] px-1 py-1 text-[10px] leading-none text-white">나</span>}
                          </div>
                        </th>
                        {data.days.map((day) => (
                          <td key={day} aria-label={`${day} 인증 ${member.dailyResults[day]?.count ?? 0}회`} className={`px-2 py-3 text-center ${day === data.today ? todayBackground : ""}`}>
                            <DailyWorkoutMark count={member.dailyResults[day]?.count ?? 0} />
                          </td>
                        ))}
                        {data.days.length > 0 && <td className="px-3 py-3 text-center font-bold text-[#5e4ea5]">{member.validWorkoutCount}회</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
