import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { deleteWorkoutPostAction, togglePostReactionAction, toggleWorkoutPostInvalidAction } from "@/app/actions";
import { AppDialog } from "@/components/ui/app-dialog";
import type { User, WorkoutPost } from "@/domain/models";
import { getPostReactionOption, POST_REACTION_OPTIONS, PostReactionIcon, type PostReactionType } from "@/domain/post-reactions";
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
          <img src={imageSrc} alt="운동 인증" loading="lazy" className={mediaClassName} />
        </button>
      )}
      {activeMedia?.url && activeMedia.type === "image" && !onOpen && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageSrc} alt="운동 인증" loading="lazy" className={mediaClassName} />
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
  onEdit,
}: {
  post: WorkoutPost;
  users: User[];
  currentUserId?: string;
  isAdmin?: boolean;
  compact?: boolean;
  mediaVariant?: "preview" | "carousel";
  onOpen?: (postId: string) => void;
  onEdit?: (post: WorkoutPost) => void;
}) {
  const user = getUserById(users, post.userId);
  const displayUser = user ?? { name: "알 수 없는 사용자", avatarUrl: undefined };
  const createdAt = new Date(post.createdAt);
  const createdAtText = formatPostDateTime(createdAt);
  const isOwnPost = currentUserId === post.userId;
  const canOpenPostMenu = isAdmin || isOwnPost;
  const adminMenuRef = useRef<HTMLDivElement>(null);
  const reactionPickerRef = useRef<HTMLDivElement>(null);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reactionUsersDialogOpen, setReactionUsersDialogOpen] = useState(false);
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const [submittingReactionType, setSubmittingReactionType] = useState<PostReactionType | null>(null);
  const router = useRouter();
  const openPost = onOpen ? () => onOpen(post.id) : undefined;
  const selectedReactionTypes = new Set(post.currentUserReactionTypes);
  const visibleReactionSummaries = POST_REACTION_OPTIONS
    .filter((option) => post.reactionSummaries.some((summary) => summary.type === option.type))
    .slice(0, 3);

  const handleToggleReaction = async (reactionType: PostReactionType) => {
    if (submittingReactionType) {
      return;
    }

    const formData = new FormData();
    formData.append("postId", post.id);
    formData.append("reactionType", reactionType);
    setSubmittingReactionType(reactionType);

    try {
      await togglePostReactionAction(formData);
      router.refresh();
    } finally {
      setSubmittingReactionType(null);
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

  useEffect(() => {
    if (!reactionPickerOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!reactionPickerRef.current?.contains(event.target as Node)) {
        setReactionPickerOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [reactionPickerOpen]);

  return (
    <article className="relative rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center gap-3 p-4 pb-3">
        <Avatar name={displayUser.name} imageUrl={displayUser.avatarUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold">{displayUser.name}</p>
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
                {isOwnPost && onEdit && (
                  <button
                    type="button"
                    className="w-full px-4 py-3 text-left text-sm font-bold text-slate-950"
                    onClick={() => {
                      setAdminMenuOpen(false);
                      onEdit(post);
                    }}
                  >
                    수정
                  </button>
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
        <MediaCarousel key={post.media.map((media) => media.id).join(":")} media={post.media} variant={mediaVariant} isInvalid={post.isInvalid} onOpen={onOpen ? () => onOpen(post.id) : undefined} />
      )}
      <div
        className={`space-y-3 p-4 ${openPost ? "cursor-pointer" : ""}`}
        onClick={openPost}
      >
        {post.content && (
          <p className={`whitespace-pre-wrap break-words text-sm leading-5 text-slate-700 ${mediaVariant === "preview" ? "line-clamp-3" : ""}`}>
            {post.content}
          </p>
        )}
        <div>
          {post.workoutType && <Badge tone="green">{post.workoutType}</Badge>}
          <div className="mt-3 flex items-center justify-between gap-2">
            <div ref={reactionPickerRef} className="relative min-w-0">
              <div className="flex items-center gap-1.5">
                {post.reactionCount > 0 ? (
                  <button
                    type="button"
                    className="inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-xs font-bold text-slate-700 ring-1 ring-slate-200"
                    aria-label={`반응한 사람 ${post.reactionCount}명 보기`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setReactionUsersDialogOpen(true);
                    }}
                  >
                    <span className="flex items-center gap-1">
                      {visibleReactionSummaries.map((option) => (
                        <PostReactionIcon key={option.type} type={option.type} size={18} />
                      ))}
                    </span>
                    <span>{post.reactionCount}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-slate-50 px-3 text-xs font-bold text-slate-500 ring-1 ring-slate-200"
                    aria-label="반응 남기기"
                    onClick={(event) => {
                      event.stopPropagation();
                      setReactionPickerOpen((open) => !open);
                    }}
                  >
                    <PostReactionIcon type="fun" size={18} />
                    <span>어떤 반응을 남겨볼까요?</span>
                  </button>
                )}
                {post.reactionCount > 0 && (
                  <button
                    type="button"
                    className="grid h-9 w-9 place-items-center rounded-full bg-slate-50 text-sm ring-1 ring-slate-200"
                    aria-label="반응 추가 또는 해제"
                    aria-expanded={reactionPickerOpen}
                    onClick={(event) => {
                      event.stopPropagation();
                      setReactionPickerOpen((open) => !open);
                    }}
                  >
                    <PostReactionIcon type="fun" size={18} />
                  </button>
                )}
              </div>

              {reactionPickerOpen && (
                <div
                  className="absolute bottom-11 left-0 z-40 w-[min(88vw,22rem)] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-500/10"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="grid grid-cols-5 gap-1.5">
                    {POST_REACTION_OPTIONS.map((option) => {
                      const selected = selectedReactionTypes.has(option.type);
                      return (
                        <button
                          key={option.type}
                          type="button"
                          disabled={Boolean(submittingReactionType)}
                          className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl px-1 text-center transition-colors disabled:opacity-50 ${
                            selected ? "bg-[#F2F0FA] text-[#51438f] ring-1 ring-[#8B7ED0]" : "text-slate-600 active:bg-slate-50"
                          }`}
                          aria-pressed={selected}
                          onClick={() => handleToggleReaction(option.type)}
                        >
                          <PostReactionIcon type={option.type} size={28}/>
                          <span className="text-[11px] font-extrabold leading-4">{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
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
        open={reactionUsersDialogOpen}
        title="반응한 사람"
        dismissOnBackdrop
        onClose={() => setReactionUsersDialogOpen(false)}
        actions={[
          {
            label: "닫기",
            variant: "primary",
            onClick: () => setReactionUsersDialogOpen(false),
          },
        ]}
      >
        {post.reactions.length > 0 ? (
          <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
            {post.reactions.map((reaction, index) => {
              const reactionUser = users.find((candidate) => candidate.id === reaction.userId);
              const reactionOption = getPostReactionOption(reaction.type);
              return (
                <div key={`${reaction.userId}-${reaction.type}-${reaction.createdAt}-${index}`} className="flex items-center gap-3">
                  <Avatar name={reactionUser?.name ?? "알 수 없는 사용자"} imageUrl={reactionUser?.avatarUrl} />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-950">{reactionUser?.name ?? "알 수 없는 사용자"}</span>
                  <PostReactionIcon type={reaction.type} size={28} />
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm font-semibold text-slate-500">아직 반응이 없습니다.</p>
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
