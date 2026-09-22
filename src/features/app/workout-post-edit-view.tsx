import { useEffect, useState } from "react";

import { getWorkoutPostByIdAction } from "@/app/actions";
import type { WorkoutPost } from "@/domain/models";
import { CertView } from "./cert-view";

export function WorkoutPostEditView({ postId, currentUserId, onUpdated, onComplete, onBack }: {
  postId: string;
  currentUserId: string;
  onUpdated: (post?: WorkoutPost) => void;
  onComplete: (post?: WorkoutPost) => void;
  onBack: () => void;
}) {
  const [post, setPost] = useState<WorkoutPost | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    setPost(null);
    setLoadError(false);
    getWorkoutPostByIdAction(postId)
      .then((result) => {
        if (!active) {
          return;
        }
        if (!result || result.userId !== currentUserId) {
          setLoadError(true);
          return;
        }
        setPost(result);
      })
      .catch(() => {
        if (active) {
          setLoadError(true);
        }
      });
    return () => {
      active = false;
    };
  }, [postId, currentUserId]);

  return (
    <div className="min-h-full bg-slate-50 pt-4">
      <div className="mx-4 flex items-center gap-3 px-1">
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-900"
          aria-label="이전 화면으로 돌아가기"
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
        <h2 className="text-[17px] font-extrabold">운동 인증 수정</h2>
      </div>
      {loadError ? (
        <p role="alert" className="p-8 text-center text-sm text-slate-500">게시글을 불러올 수 없습니다. 이전 화면에서 다시 시도해주세요.</p>
      ) : post ? (
        <CertView key={post.id} postToEdit={post} onPostUpdated={onUpdated} onEditComplete={onComplete} />
      ) : (
        <p role="status" className="p-8 text-center text-sm text-slate-500">불러오는 중입니다.</p>
      )}
    </div>
  );
}
