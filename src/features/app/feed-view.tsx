import { useMemo, useState } from "react";

import type { User, WorkoutPost } from "@/domain/models";
import { PostCard } from "./post-card";

export function FeedView({
  isAdmin,
  posts,
  currentUserId,
  users,
  onPostOpen,
}: {
  isAdmin: boolean;
  posts: WorkoutPost[];
  currentUserId: string;
  users: User[];
  onPostOpen: (postId: string) => void;
}) {
  const [mineOnly, setMineOnly] = useState(false);
  const visiblePosts = useMemo(
    () => posts.filter((post) => !mineOnly || post.userId === currentUserId),
    [currentUserId, mineOnly, posts],
  );

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-extrabold">피드</h2>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(event) => setMineOnly(event.target.checked)}
          />
          내 인증만 보기
        </label>
      </div>
      {visiblePosts.map((post) => (
        <PostCard key={post.id} post={post} currentUserId={currentUserId} isAdmin={isAdmin} users={users} onOpen={onPostOpen} />
      ))}
    </div>
  );
}
