"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { switchCurrentGroupAction } from "@/app/actions";
import type { AuthGroupSwitchOption } from "@/domain/models";

export function SeasonlessGroupSwitchSelect({ groups }: { groups: AuthGroupSwitchOption[] }) {
  const router = useRouter();
  const currentGroup = groups.find((group) => group.isCurrent);
  const switchableGroups = groups.filter((group) => group.hasActiveSeason && !group.isCurrent);
  const options = currentGroup ? [currentGroup, ...switchableGroups] : switchableGroups;
  const [selectedGroupId, setSelectedGroupId] = useState(currentGroup?.group.id ?? "");
  const [switching, setSwitching] = useState(false);

  if (switchableGroups.length === 0) {
    return <p className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold leading-5 text-slate-500">이동할 수 있는 다른 그룹이 없습니다.</p>;
  }

  const handleChange = async (groupId: string) => {
    if (!groupId || switching) {
      setSelectedGroupId(currentGroup?.group.id ?? "");
      return;
    }

    if (currentGroup && groupId === currentGroup.group.id) {
      setSelectedGroupId(currentGroup.group.id);
      return;
    }

    const formData = new FormData();
    formData.set("groupId", groupId);
    setSelectedGroupId(groupId);
    setSwitching(true);

    try {
      await switchCurrentGroupAction(formData);
      router.refresh();
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="mt-5 space-y-2">
      <label className="block text-sm font-extrabold text-slate-700" htmlFor="groupId">
        그룹 전환
      </label>
      <div className="relative">
        <select
          id="groupId"
          name="groupId"
          value={selectedGroupId}
          disabled={switching}
          className="min-h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 pr-10 text-sm leading-5 text-slate-950 outline-none transition focus:border-[#5e4ea5] focus:ring-4 focus:ring-[#5e4ea5]/10 disabled:bg-slate-100 disabled:text-slate-400"
          onChange={(event) => handleChange(event.target.value)}
        >
          {!currentGroup && <option value="">그룹을 선택해주세요</option>}
          {options.map(({ group }) => (
            <option key={group.id} value={group.id}>{group.name}</option>
          ))}
        </select>
        <svg aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
      {switching && <p className="text-xs font-bold text-slate-400">이동 중입니다.</p>}
    </div>
  );
}