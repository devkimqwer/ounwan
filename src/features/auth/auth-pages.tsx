import Image from "next/image";

import { isDevAuthEnabled } from "@/dev/auth";

export function LoginPage({ devLoginFailed = false }: { devLoginFailed?: boolean }) {
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

export function NoGroupPage() {
  return (
    <main className="min-h-dvh bg-slate-50 px-5 py-10 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-sm flex-col justify-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h1 className="text-lg font-extrabold">그룹 참여 대기 중</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
            회원 정보 설정이 완료됐습니다.
            <br />
            관리자의 승인이 완료되면 서비스를 이용할 수 있습니다.
          </p>
          <form action="/api/auth/logout" method="post" className="mt-5">
            <button type="submit" className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-950">
              로그아웃
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
