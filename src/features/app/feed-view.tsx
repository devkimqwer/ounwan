import { type RefObject, useEffect, useMemo, useRef, useState } from "react";

import { getWorkoutPostPageAction } from "@/app/actions";
import type { User, WorkoutPost, WorkoutPostCursor, WorkoutPostPage } from "@/domain/models";
import { PostCard } from "./post-card";

const FEED_LOADING_SKELETON_COUNT = 2;

export function FeedView({
  isAdmin,
  initialPage,
  initialMineOnly = false,
  currentGroupId,
  currentSeasonId,
  currentUserId,
  scrollRootRef,
  users,
  onPostOpen,
  onPostEdit,
  onFeedStateChange,
}: {
  isAdmin: boolean;
  initialPage: WorkoutPostPage;
  initialMineOnly?: boolean;
  currentGroupId: string;
  currentSeasonId?: string;
  currentUserId: string;
  scrollRootRef: RefObject<HTMLDivElement | null>;
  users: User[];
  onPostOpen: (postId: string, post?: WorkoutPost) => void;
  onPostEdit: (post: WorkoutPost) => void;
  onFeedStateChange?: (state: { page: WorkoutPostPage; mineOnly: boolean }) => void;
}) {
  const [mineOnly, setMineOnly] = useState(initialMineOnly);
  const [posts, setPosts] = useState(initialPage.posts);
  const [nextCursor, setNextCursor] = useState<WorkoutPostCursor | undefined>(initialPage.nextCursor);
  const [hasMore, setHasMore] = useState(initialPage.hasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isReloadingFilter, setIsReloadingFilter] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingCursorRef = useRef<string | null>(null);
  const postsRef = useRef(initialPage.posts);
  const feedScopeKey = `${currentGroupId}:${currentSeasonId ?? "none"}`;

  const visiblePosts = useMemo(() => posts, [posts]);

  useEffect(() => {
    setMineOnly(initialMineOnly);
    setPosts(initialPage.posts);
    postsRef.current = initialPage.posts;
    setNextCursor(initialPage.nextCursor);
    setHasMore(initialPage.hasMore);
    setIsLoadingMore(false);
    setIsReloadingFilter(false);
    loadingCursorRef.current = null;
  }, [feedScopeKey, initialMineOnly, initialPage]);

  const loadPage = async ({ cursor, nextMineOnly }: { cursor?: WorkoutPostCursor; nextMineOnly: boolean }) => {
    const cursorKey = cursor ? `${cursor.createdAt}:${cursor.id}:${nextMineOnly}` : `first:${nextMineOnly}`;
    if (loadingCursorRef.current === cursorKey) {
      return;
    }

    loadingCursorRef.current = cursorKey;

    try {
      const page = await getWorkoutPostPageAction({ cursor, mineOnly: nextMineOnly });
      const nextPosts = cursor ? mergePosts(postsRef.current, page.posts) : page.posts;
      const nextPage = { posts: nextPosts, nextCursor: page.nextCursor, hasMore: page.hasMore };
      postsRef.current = nextPosts;
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
      setPosts(nextPosts);
      onFeedStateChange?.({ page: nextPage, mineOnly: nextMineOnly });
    } catch (error) {
      console.error("[ounwan error]", error);
    } finally {
      loadingCursorRef.current = null;
    }
  };

  const handleMineOnlyChange = async (checked: boolean) => {
    setMineOnly(checked);

    setIsReloadingFilter(true);
    try {
      await loadPage({ nextMineOnly: checked });
    } finally {
      setIsReloadingFilter(false);
    }
  };

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || !nextCursor || isLoadingMore || isReloadingFilter) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting) || isLoadingMore || loadingCursorRef.current) {
          return;
        }

        setIsLoadingMore(true);
        loadPage({ cursor: nextCursor, nextMineOnly: mineOnly }).finally(() => setIsLoadingMore(false));
      },
      { root: scrollRootRef.current, rootMargin: "320px 0px", threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isReloadingFilter, mineOnly, nextCursor, scrollRootRef]);

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-extrabold">피드</h2>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(event) => void handleMineOnlyChange(event.target.checked)}
          />
          내 인증만 보기
        </label>
      </div>
      {isReloadingFilter ? (
        <FeedSkeleton />
      ) : (
        visiblePosts.map((post) => (
          <PostCard key={post.id} post={post} currentUserId={currentUserId} isAdmin={isAdmin} users={users} onOpen={(postId) => onPostOpen(postId, post)} onEdit={onPostEdit} />
        ))
      )}
      {!isReloadingFilter && isLoadingMore && <FeedSkeleton />}
      <div ref={sentinelRef} className="h-1" aria-hidden="true" />
    </div>
  );
}

function mergePosts(currentPosts: WorkoutPost[], nextPosts: WorkoutPost[]) {
  const existingIds = new Set(currentPosts.map((post) => post.id));
  return [...currentPosts, ...nextPosts.filter((post) => !existingIds.has(post.id))];
}

function FeedSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: FEED_LOADING_SKELETON_COUNT }, (_, index) => (
        <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-slate-100" />
            <div className="space-y-2">
              <div className="h-3 w-24 rounded-full bg-slate-100" />
              <div className="h-2.5 w-32 rounded-full bg-slate-100" />
            </div>
          </div>
          <div className="mt-4 aspect-[4/3] rounded-2xl bg-slate-100" />
        </div>
      ))}
    </div>
  );
}
