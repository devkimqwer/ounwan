import type { User, WorkoutPost } from "@/domain/models";
import { PostCard } from "./post-card";

export function CalendarView({
  currentUserId,
  isAdmin,
  posts,
  users,
  onPostOpen,
}: {
  currentUserId: string;
  isAdmin: boolean;
  posts: WorkoutPost[];
  users: User[];
  onPostOpen: (postId: string) => void;
}) {
  const days = Array.from({ length: 31 }, (_, index) => index + 1);
  const certifiedDays = new Set([14, 15, 17, 18]);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <button type="button" className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold">
          이전
        </button>
        <h2 className="text-[17px] font-extrabold">2026년 8월</h2>
        <button type="button" className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold">
          다음
        </button>
      </div>
      <div className="grid grid-cols-7 gap-2 rounded-2xl border border-slate-200 bg-white p-3">
        {days.map((day) => (
          <button
            key={day}
            type="button"
            className="relative grid aspect-square place-items-center rounded-xl text-[13px] font-semibold text-slate-700"
          >
            {day}
            {certifiedDays.has(day) && (
              <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-[#5e4ea5]" />
            )}
          </button>
        ))}
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold text-slate-400">8월 18일 인증</p>
        <div className="mt-3 space-y-3">
          {posts
            .filter((post) => post.workoutDate === "2026-08-18")
            .map((post) => (
              <PostCard key={post.id} post={post} currentUserId={currentUserId} isAdmin={isAdmin} users={users} onOpen={onPostOpen} />
            ))}
        </div>
      </section>
    </div>
  );
}
