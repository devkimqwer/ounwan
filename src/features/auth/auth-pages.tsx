import Image from "next/image";

export function LoginPage() {
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
