import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createPostCommentAction } from "@/app/actions";
import type { CreatePostCommentState } from "@/app/actions";
import { AppDialog } from "@/components/ui/app-dialog";
import type { User, WorkoutPost } from "@/domain/models";
import { PostCard } from "./post-card";
import { Avatar, formatPostDateTime, getUserById } from "./shared-ui";

export function PostDetailView({
  post,
  users,
  currentUserId,
  isAdmin,
  onBack,
}: {
  post: WorkoutPost;
  users: User[];
  currentUserId: string;
  isAdmin: boolean;
  onBack: () => void;
}) {
  const router = useRouter();
  const initialCommentState: CreatePostCommentState = { status: "idle", message: "" };
  const [commentState, setCommentState] = useState<CreatePostCommentState>(initialCommentState);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [commentContent, setCommentContent] = useState("");
  const [isCommentSubmitting, setIsCommentSubmitting] = useState(false);

  useEffect(() => {
    if (commentState.message) {
      setCommentDialogOpen(true);
    }
  }, [commentState]);

  const handleSubmitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isCommentSubmitting) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    setCommentState(initialCommentState);
    setCommentDialogOpen(false);
    setIsCommentSubmitting(true);

    try {
      const result = await createPostCommentAction(commentState, formData);
      setCommentState(result);

      if (result.status === "success") {
        setCommentContent("");
        form.reset();
        router.refresh();
      }
    } catch {
      setCommentState({ status: "error", message: "댓글 등록 중 문제가 발생했습니다." });
    } finally {
      setIsCommentSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-3 px-1">
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-900"
          aria-label="게시글 목록으로 돌아가기"
          onClick={onBack}
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
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h2 className="text-[17px] font-extrabold">게시글 상세</h2>
      </div>
      <PostCard
        post={post}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        users={users}
        mediaVariant="carousel"
      />
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-950">댓글</h3>
          <span className="text-sm font-bold text-slate-400">{post.commentCount}</span>
        </div>
        <div className="mt-4 space-y-4">
          {post.comments.length > 0 ? (
            post.comments.map((comment) => {
              const user = getUserById(users, comment.userId);
              return (
                <div key={comment.id} className="flex gap-3">
                  <Avatar name={user.name} imageUrl={user.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <p className="text-sm font-extrabold text-slate-950">{user.name}</p>
                      <p className="text-xs font-semibold text-slate-400">{formatPostDateTime(new Date(comment.createdAt))}</p>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium leading-5 text-slate-700">{comment.content}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-400">아직 댓글이 없습니다.</p>
          )}
        </div>
        <form onSubmit={handleSubmitComment} className="mt-4 flex items-end gap-2">
          <input type="hidden" name="postId" value={post.id} />
          <textarea
            name="content"
            value={commentContent}
            onChange={(event) => setCommentContent(event.target.value)}
            rows={1}
            className="min-h-11 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-5 outline-none placeholder:text-slate-400 focus:border-[#5e4ea5] focus:bg-white"
            placeholder="댓글을 입력하세요."
          />
          <button
            type="submit"
            disabled={isCommentSubmitting || !commentContent.trim()}
            className="min-h-11 rounded-2xl bg-slate-950 px-4 text-sm font-extrabold text-white disabled:bg-slate-300"
          >
            등록
          </button>
        </form>
      </section>
      <AppDialog
        open={commentDialogOpen && commentState.status === "error"}
        title="확인해주세요"
        description={commentState.message}
        role="alertdialog"
        dismissOnBackdrop
        onClose={() => setCommentDialogOpen(false)}
        actions={[
          {
            label: "확인",
            variant: "primary",
            onClick: () => setCommentDialogOpen(false),
          },
        ]}
      />
    </div>
  );
}
