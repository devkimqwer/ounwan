import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createBankBalanceRecordAction, type CreateBankBalanceRecordState } from "@/app/actions";
import { AppDialog } from "@/components/ui/app-dialog";
import { compressImageFileForUpload } from "./media-compression";
import { AppSubPageHeader } from "./shared-ui";

const initialState: CreateBankBalanceRecordState = { status: "idle", message: "" };
const MAX_BALANCE_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;

type BalanceImagePreview = {
  id: string;
  name: string;
  url: string;
  file: File;
};

export function BalanceRegistrationView({ onBack, onCreated }: { onBack: () => void; onCreated: () => void }) {
  const router = useRouter();
  const previewRef = useRef<BalanceImagePreview | null>(null);
  const [preview, setPreview] = useState<BalanceImagePreview | null>(null);
  const [state, setState] = useState<CreateBankBalanceRecordState>(initialState);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatusMessage, setSubmitStatusMessage] = useState("");

  useEffect(() => {
    previewRef.current = preview;
  }, [preview]);

  useEffect(() => {
    if (state.message) {
      setMessageDialogOpen(true);
    }
  }, [state]);

  useEffect(() => {
    return () => {
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current.url);
      }
    };
  }, []);

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    const file = selectedFiles[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!isPreviewableImageFile(file)) {
      setState({ status: "error", message: "이미지 파일만 업로드할 수 있습니다." });
      return;
    }

    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current.url);
    }

    const nextPreview = {
      id: `${file.name}-${file.lastModified}-${file.size}`,
      name: file.name,
      url: URL.createObjectURL(file),
      file,
    };
    setPreview(nextPreview);
  };

  const handleRemoveImage = () => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current.url);
    }
    setPreview(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.delete("imageFile");

    setState(initialState);
    setMessageDialogOpen(false);
    setIsSubmitting(true);
    setSubmitStatusMessage("업로드 중입니다.");

    try {
      if (preview) {
        const compressionResult = await compressImageFileForUpload(preview.file);
        const uploadFile = compressionResult.file;

        if (uploadFile.size > MAX_BALANCE_IMAGE_UPLOAD_BYTES) {
          setState({ status: "error", message: "잔고 이미지는 5MB 이하로 선택해주세요." });
          return;
        }

        formData.append("imageFile", uploadFile);
      }

      const result = await createBankBalanceRecordAction(initialState, formData);
      setState(result);
      if (result.status === "success") {
        if (previewRef.current) {
          URL.revokeObjectURL(previewRef.current.url);
        }
        previewRef.current = null;
        setPreview(null);
        form.reset();
        router.refresh();
      }
    } catch {
      setState({ status: "error", message: "잔고 현황을 등록할 수 없습니다." });
    } finally {
      setSubmitStatusMessage("");
      setIsSubmitting(false);
    }
  };

  const handleCloseMessageDialog = () => {
    setMessageDialogOpen(false);
    if (state.status === "success") {
      onCreated();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="min-h-full bg-slate-50 pb-24">
      <AppSubPageHeader title="잔고 등록" onBack={onBack} />

      <div className="space-y-4 p-4">
        <section>
          <div className="space-y-4">
            <div>
              <label className="block cursor-pointer rounded-2xl border border-dashed border-[#CDC6E8] bg-[#F7F5FC] p-6 text-center">
                <span className="block text-sm font-extrabold text-[#51438f]">통장 잔고 사진 업로드</span>
                <span className="mt-1 block text-xs font-semibold text-[#7568aa]">
                  1개 선택 필수 <span className="text-red-500">*</span>
                </span>
                <input
                  name="imageFile"
                  type="file"
                  accept="image/*,.heic,.heif"
                  className="sr-only"
                  onChange={handleImageChange}
                />
              </label>

              {preview && (
                <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="relative aspect-[4/3] bg-slate-100">
                    <button
                      type="button"
                      aria-label={`${preview.name} 삭제`}
                      className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-full bg-slate-950/75 text-xs font-extrabold leading-none text-white shadow-sm"
                      onClick={handleRemoveImage}
                    >
                      X
                    </button>
                    <img src={preview.url} alt={preview.name} className="h-full w-full object-cover" />
                  </div>
                  <p className="truncate px-3 py-2 text-xs font-semibold text-slate-500">{preview.name}</p>
                </div>
              )}
            </div>

            <textarea
              name="memo"
              maxLength={500}
              className="min-h-28 w-full resize-none rounded-2xl border border-slate-200 bg-white p-3.5 text-sm leading-5 outline-none placeholder:text-sm placeholder:text-slate-400 focus:border-[#5e4ea5]"
              placeholder="내용을 입력하세요. (선택사항)"
            />

            {submitStatusMessage && <div className="rounded-2xl bg-[#F7F5FC] px-4 py-3 text-sm font-bold text-[#51438f]">{submitStatusMessage}</div>}
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 z-30 px-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-2xl bg-slate-950 py-3.5 text-base font-extrabold text-white shadow-sm disabled:bg-slate-300"
        >
          {isSubmitting ? submitStatusMessage || "등록 중" : "잔고 등록"}
        </button>
      </div>

      <AppDialog
        open={messageDialogOpen && Boolean(state.message)}
        title={state.status === "success" ? "등록 완료" : "확인해주세요"}
        description={state.message}
        role="alertdialog"
        dismissOnBackdrop={state.status !== "success"}
        onClose={handleCloseMessageDialog}
        actions={[{ label: "확인", variant: "primary", onClick: handleCloseMessageDialog }]}
      />
    </form>
  );
}

function isPreviewableImageFile(file: File) {
  return file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name);
}