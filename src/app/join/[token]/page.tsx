import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

import { getCurrentUserId } from "@/auth/session";
import { getValidGroupInviteByToken } from "@/db/queries";
import { requestGroupJoinAction } from "./actions";

export const dynamic = "force-dynamic";

type JoinPageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ status?: string }>;
};

export default async function JoinPage({ params, searchParams }: JoinPageProps) {
  const { token } = await params;
  const { status } = await searchParams;
  const invite = await getValidGroupInviteByToken(token);
  const currentUserId = await getCurrentUserId();
  const returnTo = `/join/${encodeURIComponent(token)}`;

  if (!invite) {
    return <JoinShell title="초대 링크를 사용할 수 없습니다." description="초대 링크가 만료됐거나 더 이상 유효하지 않습니다." />;
  }

  if (!currentUserId) {
    return (
      <JoinShell title={`${invite.group.name}에 초대받았습니다.`} description={`${invite.createdByUser.name}님이 오운완 그룹에 초대했습니다.`}>
        <a
          href={`/api/auth/kakao?returnTo=${encodeURIComponent(returnTo)}`}
          className="mt-6 flex min-h-12 items-center justify-center rounded-2xl bg-[#FEE500] px-4 text-base font-extrabold text-[#3C1E1E] shadow-sm"
        >
          카카오로 로그인하고 참여하기
        </a>
      </JoinShell>
    );
  }

  const completed = status === "requested" || status === "pending";

  return (
    <JoinShell
      title={completed ? "참여 요청이 접수됐습니다." : `${invite.group.name}에 참여하시겠습니까?`}
      description={
        completed
          ? "관리자의 승인이 완료되면 서비스를 이용할 수 있습니다."
          : `${invite.createdByUser.name}님이 오운완 그룹에 초대했습니다.`
      }
    >
      {completed ? (
        <Link
          href="/"
          className="mt-6 flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-950"
        >
          홈으로 이동
        </Link>
      ) : (
        <form action={requestGroupJoinAction} className="mt-6">
          <input type="hidden" name="token" value={token} />
          <button type="submit" className="min-h-12 w-full rounded-2xl bg-slate-950 px-4 text-base font-extrabold text-white active:bg-slate-800">
            참여 요청하기
          </button>
        </form>
      )}
    </JoinShell>
  );
}

function JoinShell({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return (
    <main className="min-h-dvh bg-slate-50 px-5 py-10 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-sm flex-col justify-center">
        <section className="text-center">
          <Image
            src="/assets/ounwan-logo-transparent-bg.png"
            alt="ounwan"
            width={104}
            height={30}
            priority
            className="mx-auto h-6 w-auto"
          />
          <h1 className="mt-6 text-xl font-extrabold leading-7 text-slate-950">{title}</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{description}</p>
          {children}
        </section>
      </div>
    </main>
  );
}