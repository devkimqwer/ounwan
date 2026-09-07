import type { ReactNode } from "react";
import Image from "next/image";

import type { AuthGroupSwitchOption, PendingGroupJoinRequest } from "@/domain/models";
import { isDevAuthEnabled } from "@/dev/auth";
import { CreateGroupForm } from "./create-group-form";
import { SeasonlessGroupSwitchSelect } from "./seasonless-group-switch-select";

export function LoginPage({ authBlocked = false, devLoginFailed = false }: { authBlocked?: boolean; devLoginFailed?: boolean }) {
  const showDevLogin = isDevAuthEnabled();

  return (
    <main className="min-h-dvh bg-slate-50 px-5 py-10 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-sm flex-col justify-center">
        <div className="text-center">
          <Image
            src="/assets/ounwan-logo-transparent-bg.png"
            alt="ounwan"
            width={104}
            height={30}
            priority
            className="mx-auto h-6 w-auto"
          />
          <p className="mt-4 text-sm font-semibold leading-6 text-slate-500">친구들과 함께 운동을 기록하세요.</p>
        </div>
        <a
          href="/api/auth/kakao"
          className="mt-7 flex min-h-12 items-center justify-center rounded-2xl bg-[#FEE500] px-4 text-base font-extrabold text-[#3C1E1E] shadow-sm"
        >
          카카오로 시작하기
        </a>
        {authBlocked && <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold leading-5 text-red-600">차단된 계정은 로그인할 수 없습니다.</p>}
        {showDevLogin && (
          <form action="/api/dev/auth/login" method="post" className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-4">
            <p className="text-xs font-extrabold text-slate-500">개발용 강제 로그인</p>
            <div className="mt-3 flex gap-2">
              <input
                name="userId"
                inputMode="numeric"
                pattern="[0-9]*"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-[#5e4ea5]"
                placeholder="사용자 ID"
                aria-label="개발용 로그인 사용자 ID"
                required
              />
              <button type="submit" className="rounded-xl bg-slate-950 px-4 text-sm font-extrabold text-white">
                로그인
              </button>
            </div>
            {devLoginFailed && <p className="mt-2 text-xs font-bold text-red-600">사용자 ID를 확인해주세요.</p>}
          </form>
        )}
      </div>
    </main>
  );
}

export function PendingGroupJoinPage({ requests }: { requests: PendingGroupJoinRequest[] }) {
  return (
    <AuthStatusShell title="그룹 참여 승인 대기 중">
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
        관리자의 승인이 완료되면 서비스를 이용할 수 있습니다.
      </p>
      <div className="mt-5 space-y-2">
        {requests.map((request) => (
          <div key={request.id} className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-extrabold text-slate-950">{request.group.name}</p>
              <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-extrabold text-amber-700">대기</span>
            </div>
            <p className="mt-1 text-xs font-bold text-slate-500">요청일 {formatDate(request.requestedAt)}</p>
          </div>
        ))}
      </div>
      <LogoutForm />
    </AuthStatusShell>
  );
}

export function NoGroupPage() {
  return (
    <AuthStatusShell title="그룹이 아직 없습니다">
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
        초대 링크로 참여 요청을 보내거나, 직접 그룹을 만들어 시작할 수 있습니다.
        그룹을 만든 사용자는 해당 그룹의 관리자가 됩니다.
      </p>
      <CreateGroupForm />
      <LogoutForm />
    </AuthStatusShell>
  );
}

export function NoActiveSeasonPage({ groups }: { groups: AuthGroupSwitchOption[] }) {
  return (
    <AuthStatusShell title="시즌이 아직 없습니다">
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
        현재 그룹에는 진행 중인 시즌이 없습니다.
        <br/>
        참여중인 다른 그룹이 있다면 그룹으로 전환하여 서비스를 이용할 수 있습니다.
      </p>
      <SeasonlessGroupSwitchSelect groups={groups} />
      <LogoutForm />
    </AuthStatusShell>
  );
}

function AuthStatusShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-slate-50 px-5 py-10 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-sm flex-col justify-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h1 className="text-lg font-extrabold">{title}</h1>
          {children}
        </div>
      </div>
    </main>
  );
}


function LogoutForm() {
  return (
    <form action="/api/auth/logout" method="post" className="mt-5">
      <button type="submit" className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-950">
        로그아웃
      </button>
    </form>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}