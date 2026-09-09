import type { User, WeeklyUserWorkoutStatus, WorkoutPost } from "@/domain/models";
import { PostCard } from "./post-card";

export function HomeView({
  userName,
  currentUserId,
  weeklyStatus,
  onCert,
  onFeed,
  onPostOpen,
  isAdmin,
  posts,
  users,
}: {
  userName: string;
  currentUserId: string;
  weeklyStatus: WeeklyUserWorkoutStatus;
  onCert: () => void;
  onFeed: () => void;
  onPostOpen: (postId: string) => void;
  isAdmin: boolean;
  posts: WorkoutPost[];
  users: User[];
}) {
  const recentPosts = posts.filter((post) => !post.isInvalid).slice(0, 2);
  const targetCount = weeklyStatus.targetWorkoutCount;
  const completedCount = Math.min(weeklyStatus.validWorkoutCount, targetCount);
  const remainingCount = weeklyStatus.missedCount;
  const progressPercent = targetCount > 0 ? (completedCount / targetCount) * 100 : 0;
  const weekRange = `${formatShortDate(weeklyStatus.weekStartDate)} ~ ${formatShortDate(weeklyStatus.weekEndDate)}`;
  const finePerMissText = formatCurrency(weeklyStatus.finePerMiss);
  const estimatedFineText = formatCurrency(weeklyStatus.estimatedFineAmount);

  return (
    <div className="space-y-4 p-4">
      <div className="px-1 pt-1">
        <p className="text-lg font-extrabold text-slate-950">좋은 하루, {userName}님 🖐️</p>
        <p className="mt-1 text-[13px] font-semibold text-slate-500">오늘도 오운완 가보자고!</p>
      </div>

      <button
        type="button"
        className="w-full rounded-2xl border border-[#CDC6E8] bg-[#F7F5FC] px-5 py-4 text-left text-[#51438f]"
        onClick={onCert}
      >
        <span className="block text-[13px] font-extrabold text-[#51438f]">오늘의 인증</span>
        <span className="mx-auto mt-3 grid h-28 w-28 place-items-center rounded-full border border-dashed border-[#BDB4DE] bg-white/80 text-slate-900">
          <span className="flex flex-col items-center gap-2">
            <svg
              aria-hidden="true"
              className="h-8 w-8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
              <circle cx="12" cy="13" r="3" />
            </svg>
            <span className="text-[13px] font-extrabold">인증하기</span>
          </span>
        </span>
      </button>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-extrabold text-slate-900">이번 주 나의 현황</h2>
          <span className="shrink-0 text-xs font-bold text-slate-400">{weekRange}</span>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <div className="flex flex-1 gap-2">
            {Array.from({ length: targetCount }, (_, index) => (
              <span
                key={index}
                className={`grid h-10 w-10 place-items-center rounded-full border text-base font-bold ${
                  index < completedCount
                    ? "border-[#5e4ea5] bg-[#5e4ea5] text-white"
                    : "border-slate-200 bg-white text-slate-300"
                }`}
              >
                ✓
              </span>
            ))}
          </div>
          <div className="shrink-0 text-right">
            <span className="text-2xl font-extrabold text-slate-950">{completedCount}</span>
            <span className="ml-1 text-lg font-extrabold text-slate-300">/ {targetCount}회</span>
          </div>
        </div>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-[#5e4ea5]" style={{ width: `${progressPercent}%` }} />
        </div>
        <p className="mt-3 text-[13px] font-bold text-slate-400">
          {remainingCount > 0
            ? `이번 주 ${remainingCount}번만 더 인증하면 돼요.`
            : "이번 주 목표를 달성했어요!"}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-center">
            <span className="block text-[11px] font-bold text-slate-400">1회 미달 벌금</span>
            <span className="mt-1 block text-sm font-extrabold text-slate-900">{finePerMissText}</span>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-center">
            <span className="block text-[11px] font-bold text-slate-400">현재 예상 벌금</span>
            <span className="mt-1 block text-sm font-extrabold text-[#5e4ea5]">{estimatedFineText}</span>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-sm font-extrabold">최근 피드</h2>
          <button type="button" className="text-xs font-semibold text-[#5e4ea5]" onClick={onFeed}>
            전체보기
          </button>
        </div>
        <div className="space-y-3">
          {recentPosts.map((post) => (
            <PostCard key={post.id} post={post} currentUserId={currentUserId} isAdmin={isAdmin} users={users} onOpen={onPostOpen} />
          ))}
        </div>
      </section>
    </div>
  );
}

function formatShortDate(value: string) {
  const date = new Date(value);
  return `${date.getMonth() + 1}.${date.getDate()}`;
}

function formatCurrency(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}
