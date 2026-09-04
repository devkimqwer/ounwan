import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { deleteWorkoutPostAction, togglePostLikeAction, toggleWorkoutPostInvalidAction } from "@/app/actions";
import { AppDialog } from "@/components/ui/app-dialog";
import type { User, WorkoutPost } from "@/domain/models";
import { Avatar, Badge, formatPostDateTime, getUserById } from "./shared-ui";

export function MediaCarousel({
  media,
  variant = "preview",
  isInvalid = false,
  onOpen,
}: {
  media: WorkoutPost["media"];
  variant?: "preview" | "carousel";
  isInvalid?: boolean;
  onOpen?: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const activeMedia = media[activeIndex] ?? media[0];
  const hasMultiple = media.length > 1;
  const hiddenMediaCount = Math.max(media.length - 1, 0);
  const imageSrc = variant === "carousel" ? activeMedia?.url : activeMedia?.thumbnailUrl ?? activeMedia?.url;
  const containerClassName = variant === "carousel" ? "mx-4 touch-pan-y" : "mx-4 aspect-[4/3]";
  const mediaClassName = variant === "carousel" ? "h-auto w-full object-contain" : "h-full w-full object-cover";

  const move = (offset: number) => {
    setActiveIndex((current) => (current + offset + media.length) % media.length);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (hasMultiple && variant === "carousel") {
      setDragStartX(event.clientX);
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartX === null) {
      return;
    }

    const movedX = event.clientX - dragStartX;
    setDragStartX(null);

    if (Math.abs(movedX) < 45) {
      return;
    }

    move(movedX < 0 ? 1 : -1);
  };

  return (
    <div
      className={`${containerClassName} relative overflow-hidden rounded-2xl bg-slate-100`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => setDragStartX(null)}
    >
      {activeMedia?.url && activeMedia.type === "image" && onOpen && (
        <button
          type="button"
          className="block h-full w-full"
          aria-label="게시글 상세보기"
          onClick={onOpen}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageSrc} alt="운동 인증" className={mediaClassName} />
        </button>
      )}
      {activeMedia?.url && activeMedia.type === "image" && !onOpen && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageSrc} alt="운동 인증" className={mediaClassName} />
        </>
      )}
      {activeMedia?.url && activeMedia.type === "video" && onOpen && (
        <button
          type="button"
          className="relative block h-full w-full"
          aria-label="게시글 상세보기"
          onClick={onOpen}
        >
          <video src={activeMedia.url} preload="metadata" className="h-full w-full object-cover" />
          <span className="absolute inset-0 grid place-items-center bg-black/10" aria-hidden="true">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-white/90 text-slate-950 shadow-sm">
              <svg
                className="ml-1 h-6 w-6"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
        </button>
      )}
      {activeMedia?.url && activeMedia.type === "video" && !onOpen && (
        <video src={activeMedia.url} controls preload="metadata" className={mediaClassName} />
      )}
      {!activeMedia?.url && (
        <div className={`${variant === "carousel" ? "min-h-80" : "h-full"} grid place-items-center text-xs font-bold text-slate-400`}>이미지 없음</div>
      )}

      {isInvalid && variant === "preview" && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-white/45 backdrop-blur-[2px]" aria-hidden="true">
          <span className="rounded-full bg-slate-950/65 px-4 py-2 text-sm font-extrabold text-white shadow-sm">무효 처리됨</span>
        </div>
      )}

      {hasMultiple && variant === "preview" && (
        <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-sm font-extrabold leading-none text-white shadow-sm">
          +{hiddenMediaCount}
        </span>
      )}

      {hasMultiple && variant === "carousel" && (
        <>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 justify-center gap-1.5 rounded-full bg-black/35 px-2 py-1">
            {media.map((item, index) => (
              <span
                key={item.id}
                className={`h-1.5 rounded-full transition-all ${index === activeIndex ? "w-4 bg-white" : "w-1.5 bg-white/60"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
export function PostCard({
  post,
  users,
  currentUserId,
  isAdmin = false,
  compact = false,
  mediaVariant = "preview",
  onOpen,
}: {
  post: WorkoutPost;
  users: User[];
  currentUserId?: string;
  isAdmin?: boolean;
  compact?: boolean;
  mediaVariant?: "preview" | "carousel";
  onOpen?: (postId: string) => void;
}) {
  const user = getUserById(users, post.userId);
  const createdAt = new Date(post.createdAt);
  const createdAtText = formatPostDateTime(createdAt);
  const isOwnPost = currentUserId === post.userId;
  const canOpenPostMenu = isAdmin || isOwnPost;
  const adminMenuRef = useRef<HTMLDivElement>(null);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [likeUsersDialogOpen, setLikeUsersDialogOpen] = useState(false);
  const [isLikeSubmitting, setIsLikeSubmitting] = useState(false);
  const router = useRouter();
  const openPost = onOpen ? () => onOpen(post.id) : undefined;
  const likedUsers = post.likeUserIds
    .map((userId) => users.find((candidate) => candidate.id === userId))
    .filter((candidate): candidate is User => Boolean(candidate));

  const handleToggleLike = async () => {
    if (isLikeSubmitting) {
      return;
    }

    const formData = new FormData();
    formData.append("postId", post.id);
    setIsLikeSubmitting(true);

    try {
      await togglePostLikeAction(formData);
      router.refresh();
    } finally {
      setIsLikeSubmitting(false);
    }
  };

  const handleToggleInvalidPostAction = async (formData: FormData) => {
    await toggleWorkoutPostInvalidAction(formData);
    setAdminMenuOpen(false);
    router.refresh();
  };

  const handleDeletePostAction = async (formData: FormData) => {
    await deleteWorkoutPostAction(formData);
    setDeleteDialogOpen(false);
    router.refresh();
  };

  useEffect(() => {
    if (!adminMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!adminMenuRef.current?.contains(event.target as Node)) {
        setAdminMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [adminMenuOpen]);

  return (
    <article className="relative rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center gap-3 p-4 pb-3">
        <Avatar name={user.name} imageUrl={user.avatarUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold">{user.name}</p>
            {post.isInvalid && <Badge tone="red">노인정</Badge>}
          </div>
          <p className="text-xs text-slate-400">
            {createdAtText}
          </p>
        </div>
        {canOpenPostMenu && (
          <div ref={adminMenuRef} className="relative z-30">
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full text-slate-500"
              aria-label="게시글 더보기"
              aria-expanded={adminMenuOpen}
              onClick={() => setAdminMenuOpen((open) => !open)}
            >
              <svg
                aria-hidden="true"
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </button>
            {adminMenuOpen && (
              <div className="absolute right-0 top-10 z-40 w-32 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {isAdmin && (
                  <form action={handleToggleInvalidPostAction}>
                    <input type="hidden" name="postId" value={post.id} />
                    <button type="submit" className="w-full px-4 py-3 text-left text-sm font-bold text-slate-950">
                      {post.isInvalid ? "노인정 취소" : "노인정"}
                    </button>
                  </form>
                )}
                {isOwnPost && (
                  <button
                    type="button"
                    className="w-full px-4 py-3 text-left text-sm font-bold text-slate-950"
                    onClick={() => {
                      setAdminMenuOpen(false);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    삭제
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {!compact && (
        <MediaCarousel media={post.media} variant={mediaVariant} isInvalid={post.isInvalid} onOpen={onOpen ? () => onOpen(post.id) : undefined} />
      )}
      <div
        className={`space-y-3 p-4 ${openPost ? "cursor-pointer" : ""}`}
        onClick={openPost}
      >
        {post.content && <p className="text-sm leading-5 text-slate-700">{post.content}</p>}
        <div>
          {post.workoutType && <Badge tone="green">{post.workoutType}</Badge>}
          <div className="mt-3 flex items-center gap-2">
            <div className={`inline-flex min-h-9 items-center rounded-full text-sm font-bold ${post.likedByCurrentUser ? "text-[#F4B000]" : "text-slate-700"}`}>
              <button
                type="button"
                className="grid h-9 w-8 place-items-center rounded-full disabled:opacity-50"
                aria-label={post.likedByCurrentUser ? "따봉 취소" : "따봉"}
                aria-pressed={post.likedByCurrentUser}
                disabled={isLikeSubmitting}
                onClick={(event) => {
                  event.stopPropagation();
                  handleToggleLike();
                }}
              >
                <svg
                  aria-hidden="true"
                  className={`h-5 w-5 ${post.likedByCurrentUser ? "fill-current stroke-current" : "text-slate-500"}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M7 10v11" />
                  <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
                </svg>
              </button>
              <button
                type="button"
                className="min-h-9 rounded-full px-1.5 text-sm font-bold"
                aria-label={`따봉한 사람 ${post.likeCount}명 보기`}
                onClick={(event) => {
                  event.stopPropagation();
                  setLikeUsersDialogOpen(true);
                }}
              >
                {post.likeCount}
              </button>
            </div>
            <button
              type="button"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-bold text-slate-700"
              aria-label={`댓글 ${post.commentCount}개`}
              onClick={openPost}
            >
              <svg
                aria-hidden="true"
                className="h-5 w-5 text-slate-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
              </svg>
              <span>{post.commentCount}</span>
            </button>
          </div>
        </div>
      </div>
      <AppDialog
        open={likeUsersDialogOpen}
        title="따봉한 사람"
        dismissOnBackdrop
        onClose={() => setLikeUsersDialogOpen(false)}
        actions={[
          {
            label: "닫기",
            variant: "primary",
            onClick: () => setLikeUsersDialogOpen(false),
          },
        ]}
      >
        {likedUsers.length > 0 ? (
          <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
            {likedUsers.map((likedUser) => (
              <div key={likedUser.id} className="flex items-center gap-3">
                <Avatar name={likedUser.name} imageUrl={likedUser.avatarUrl} />
                <span className="text-sm font-bold text-slate-950">{likedUser.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm font-semibold text-slate-500">아직 따봉을 누른 사람이 없습니다.</p>
        )}
      </AppDialog>
      <AppDialog
        open={deleteDialogOpen}
        title="게시글을 삭제할까요?"
        description="삭제한 게시글은 피드에서 보이지 않습니다."
        dismissOnBackdrop
        onClose={() => setDeleteDialogOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-950"
              onClick={() => setDeleteDialogOpen(false)}
            >
              취소
            </button>
            <form action={handleDeletePostAction}>
              <input type="hidden" name="postId" value={post.id} />
              <button type="submit" className="min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-extrabold text-white">
                삭제
              </button>
            </form>
          </>
        }
      />
    </article>
  );
}
