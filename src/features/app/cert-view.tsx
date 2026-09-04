import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { createWorkoutPostAction } from "@/app/actions";
import type { CreateWorkoutPostState } from "@/app/actions";
import { AppDialog } from "@/components/ui/app-dialog";
import { compressMediaFilesForUpload } from "./media-compression";
type CertMediaPreview = {
  id: string;
  name: string;
  type: "image" | "video";
  url: string;
  file: File;
};

const MAX_WORKOUT_POST_MEDIA_COUNT = 5;
const MAX_WORKOUT_POST_UPLOAD_BYTES = 5 * 1024 * 1024;
const DEFAULT_WORKOUT_TYPES = ["러닝", "헬스"];
const MAX_RECENT_WORKOUT_TYPE_COUNT = 10;
const RECENT_WORKOUT_TYPES_STORAGE_KEY = "ounwan.recentWorkoutTypes";

export function CertView({ onPostCreated }: { onPostCreated: (postId: string) => void }) {
  const [workoutType, setWorkoutType] = useState("");
  const [recentWorkoutTypes, setRecentWorkoutTypes] = useState<string[]>(DEFAULT_WORKOUT_TYPES);
  const [mediaPreviews, setMediaPreviews] = useState<CertMediaPreview[]>([]);
  const [certMessageDialogOpen, setCertMessageDialogOpen] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const mediaPreviewsRef = useRef<CertMediaPreview[]>([]);
  const initialState: CreateWorkoutPostState = { status: "idle", message: "" };
  const [state, setState] = useState<CreateWorkoutPostState>(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatusMessage, setSubmitStatusMessage] = useState("");
  const [mediaLimitDialogOpen, setMediaLimitDialogOpen] = useState(false);

  useEffect(() => {
    setRecentWorkoutTypes(loadRecentWorkoutTypes());
  }, []);

  useEffect(() => {
    if (state.message) {
      setCertMessageDialogOpen(true);
    }
  }, [state]);

  useEffect(() => {
    mediaPreviewsRef.current = mediaPreviews;
  }, [mediaPreviews]);

  useEffect(() => {
    return () => {
      mediaPreviewsRef.current.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, []);

  const syncMediaInputFiles = (previews: CertMediaPreview[]) => {
    if (!mediaInputRef.current) {
      return;
    }

    const dataTransfer = new DataTransfer();
    previews.forEach((preview) => dataTransfer.items.add(preview.file));
    mediaInputRef.current.files = dataTransfer.files;
  };

  const createMediaPreview = (file: File): CertMediaPreview => ({
    id: `${file.name}-${file.lastModified}-${file.size}`,
    name: file.name,
    type: file.type.startsWith("video/") || isPhoneVideoFile(file) ? "video" : "image",
    url: URL.createObjectURL(file),
    file,
  });

  const handleMediaChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedPreviews = Array.from(event.target.files ?? [])
      .filter(isPreviewableMediaFile)
      .map(createMediaPreview);

    setMediaPreviews((previousPreviews) => {
      const previousIds = new Set(previousPreviews.map((preview) => preview.id));
      const appendedPreviews = selectedPreviews.filter((preview) => {
        const isDuplicate = previousIds.has(preview.id);
        if (isDuplicate) {
          URL.revokeObjectURL(preview.url);
        }
        return !isDuplicate;
      });
      const mergedPreviews = [...previousPreviews, ...appendedPreviews];
      const exceededMediaLimit = mergedPreviews.length > MAX_WORKOUT_POST_MEDIA_COUNT;
      const nextPreviews = mergedPreviews.slice(0, MAX_WORKOUT_POST_MEDIA_COUNT);
      mergedPreviews.slice(MAX_WORKOUT_POST_MEDIA_COUNT).forEach((preview) => {
        if (!previousIds.has(preview.id)) {
          URL.revokeObjectURL(preview.url);
        }
      });

      if (exceededMediaLimit) {
        setMediaLimitDialogOpen(true);
      }
      syncMediaInputFiles(nextPreviews);
      return nextPreviews;
    });
    event.target.value = "";
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.delete("mediaFiles");
    setState(initialState);
    setCertMessageDialogOpen(false);
    setIsSubmitting(true);
    setSubmitStatusMessage("업로드 중입니다.");

    try {
      const compressionResults = await compressMediaFilesForUpload(mediaPreviews.map((preview) => preview.file));
      const uploadFiles = compressionResults.map((result) => result.file);
      const uploadTotalBytes = uploadFiles.reduce((total, file) => total + file.size, 0);

      if (uploadTotalBytes > MAX_WORKOUT_POST_UPLOAD_BYTES) {
        setState({ status: "error", message: "사진 또는 영상은 최대 5개, 총 5MB 이하로 선택해주세요." });
        return;
      }

      uploadFiles.forEach((file) => formData.append("mediaFiles", file));

      const result = await createWorkoutPostAction(state, formData);
      setState(result);

      if (result.status === "success") {
        mediaPreviewsRef.current.forEach((preview) => URL.revokeObjectURL(preview.url));
        mediaPreviewsRef.current = [];
        setMediaPreviews([]);
        syncMediaInputFiles([]);
        setRecentWorkoutTypes(saveRecentWorkoutType(workoutType));
        setWorkoutType("");
        form.reset();
      }
    } catch {
      setState({ status: "error", message: "인증 등록 중 문제가 발생했습니다." });
    } finally {
      setSubmitStatusMessage("");
      setIsSubmitting(false);
    }
  };

  const handleCloseCertMessageDialog = () => {
    setCertMessageDialogOpen(false);

    if (state.status === "success" && state.postId) {
      onPostCreated(state.postId);
    }
  };

  const handleRemoveWorkoutType = (type: string) => {
    const nextTypes = recentWorkoutTypes.filter((recentType) => recentType !== type);
    setRecentWorkoutTypes(nextTypes);
    saveRecentWorkoutTypes(nextTypes);
  };

  const handleRemoveMedia = (mediaId: string) => {
    setMediaPreviews((previousPreviews) => {
      const removedPreview = previousPreviews.find((preview) => preview.id === mediaId);
      const nextPreviews = previousPreviews.filter((preview) => preview.id !== mediaId);
      if (removedPreview) {
        URL.revokeObjectURL(removedPreview.url);
      }
      syncMediaInputFiles(nextPreviews);
      return nextPreviews;
    });
  };

  return (
    <form onSubmit={handleSubmit} className="pb-24">
      <div className="p-4">
        <h2 className="text-base font-extrabold">운동 인증 등록</h2>
        <div className="mt-4 space-y-4">
        <div>
          <label className="block cursor-pointer rounded-2xl border border-dashed border-[#CDC6E8] bg-[#F7F5FC] p-6 text-center">
            <span className="block text-sm font-extrabold text-[#51438f]">사진 또는 영상 업로드</span>
            <span className="mt-1 block text-xs font-semibold text-[#7568aa]">
              1개 이상 선택 필수 <span className="text-red-500">*</span>
            </span>
            <input
              name="mediaFiles"
              type="file"
              accept="image/*,video/*,.heic,.heif,.mov,.m4v,.mp4"
              multiple
              ref={mediaInputRef}
              className="sr-only"
              onChange={handleMediaChange}
            />
          </label>
          {mediaPreviews.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {mediaPreviews.map((preview) => (
                <div key={preview.id} className="relative overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <button
                    type="button"
                    aria-label={`${preview.name} 삭제`}
                    className="absolute right-1.5 top-1.5 z-10 grid h-6 w-6 place-items-center rounded-full bg-slate-950/75 text-xs font-extrabold leading-none text-white shadow-sm"
                    onClick={() => handleRemoveMedia(preview.id)}
                  >
                    X
                  </button>
                  <div className="aspect-square bg-slate-100">
                    {preview.type === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={preview.url} alt={preview.name} className="h-full w-full object-cover" />
                    ) : (
                      <video src={preview.url} muted preload="metadata" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <p className="truncate px-2 py-1.5 text-[11px] font-semibold text-slate-500">{preview.name}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <textarea
            name="content"
            className="min-h-24 w-full resize-none rounded-2xl border border-slate-200 bg-white p-3.5 text-sm leading-5 outline-none placeholder:text-sm placeholder:text-slate-400 focus:border-[#5e4ea5]"
            placeholder="운동 소감을 입력하세요. (선택사항)"
          />
          <input
            name="workoutType"
            value={workoutType}
            onChange={(event) => setWorkoutType(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm leading-5 outline-none placeholder:text-sm placeholder:text-slate-400 focus:border-[#5e4ea5]"
            placeholder="운동 종류 직접 입력 또는 아래 목록에서 선택 (선택사항)"
          />
        </div>
        {recentWorkoutTypes.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-1">
            {recentWorkoutTypes.map((type) => {
              const selected = workoutType.trim() === type;
              return (
                <span
                  key={type}
                  className={`inline-flex min-h-8 items-center overflow-hidden rounded-full border text-xs font-semibold leading-none ${
                    selected
                      ? "border-[#5e4ea5] bg-[#5e4ea5] text-white"
                      : "border-[#DDD8F1] bg-[#F2F0FA] text-[#51438f]"
                  }`}
                >
                  <button type="button" className="min-h-8 px-3 text-xs font-semibold leading-none" onClick={() => setWorkoutType(type)}>
                    {type}
                  </button>
                  <button
                    type="button"
                    className={`grid min-h-8 w-7 place-items-center border-l text-xs font-extrabold leading-none ${
                      selected ? "border-white/20 text-white" : "border-[#DDD8F1] text-[#7568aa]"
                    }`}
                    aria-label={`${type} 삭제`}
                    onClick={() => handleRemoveWorkoutType(type)}
                  >
                    X
                  </button>
                </span>
              );
            })}
          </div>
        )}
        {submitStatusMessage && (
          <div className="rounded-2xl bg-[#F7F5FC] px-4 py-3 text-sm font-bold text-[#51438f]">{submitStatusMessage}</div>
        )}
        <AppDialog
          open={mediaLimitDialogOpen}
          title="확인해주세요"
          description="최대 5개까지만 선택 가능합니다."
          role="alertdialog"
          dismissOnBackdrop
          onClose={() => setMediaLimitDialogOpen(false)}
          actions={[
            {
              label: "확인",
              variant: "primary",
              onClick: () => setMediaLimitDialogOpen(false),
            },
          ]}
        />
        <AppDialog
          open={certMessageDialogOpen && Boolean(state.message)}
          title={state.status === "success" ? "등록 완료" : "확인해주세요"}
          description={state.message}
          role="alertdialog"
          dismissOnBackdrop={state.status !== "success"}
          onClose={handleCloseCertMessageDialog}
          actions={[
            {
              label: "확인",
              variant: "primary",
              onClick: handleCloseCertMessageDialog,
            },
          ]}
        />
        </div>
      </div>
      <div className="sticky bottom-0 z-30 px-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-2xl bg-slate-950 py-3.5 text-base font-extrabold text-white shadow-sm disabled:bg-slate-300"
        >
          {isSubmitting ? (submitStatusMessage || "등록 중") : "인증 등록"}
        </button>
      </div>
    </form>
  );
}
function loadRecentWorkoutTypes() {
  try {
    const storedValue = window.localStorage.getItem(RECENT_WORKOUT_TYPES_STORAGE_KEY);
    if (storedValue === null) {
      return DEFAULT_WORKOUT_TYPES;
    }

    const parsedValue: unknown = JSON.parse(storedValue);
    return Array.isArray(parsedValue) ? normalizeRecentWorkoutTypes(parsedValue) : DEFAULT_WORKOUT_TYPES;
  } catch {
    return DEFAULT_WORKOUT_TYPES;
  }
}

function saveRecentWorkoutType(type: string) {
  const trimmedType = type.trim();
  const nextTypes = trimmedType ? normalizeRecentWorkoutTypes([trimmedType, ...loadRecentWorkoutTypes()]) : loadRecentWorkoutTypes();
  saveRecentWorkoutTypes(nextTypes);
  return nextTypes;
}

function saveRecentWorkoutTypes(types: string[]) {
  try {
    window.localStorage.setItem(RECENT_WORKOUT_TYPES_STORAGE_KEY, JSON.stringify(normalizeRecentWorkoutTypes(types)));
  } catch {
    // Ignore storage failures so workout post registration is not blocked by browser storage settings.
  }
}

function normalizeRecentWorkoutTypes(types: unknown[]) {
  const uniqueTypes: string[] = [];

  types.forEach((type) => {
    if (typeof type !== "string") {
      return;
    }

    const trimmedType = type.trim();
    if (!trimmedType || uniqueTypes.includes(trimmedType)) {
      return;
    }

    uniqueTypes.push(trimmedType);
  });

  return uniqueTypes.slice(0, MAX_RECENT_WORKOUT_TYPE_COUNT);
}
function isPreviewableMediaFile(file: File) {
  return (
    file.type.startsWith("image/") ||
    file.type.startsWith("video/") ||
    isPhoneImageFile(file) ||
    isPhoneVideoFile(file)
  );
}

function isPhoneImageFile(file: File) {
  return /\.(heic|heif)$/i.test(file.name);
}

function isPhoneVideoFile(file: File) {
  return /\.(mov|m4v|mp4)$/i.test(file.name);
}
