import { useRef, useState } from "react";

import { AppDialog } from "@/components/ui/app-dialog";
import { withdrawAccountAction } from "./withdrawal-action";

export function TextWithdrawalButton() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const submittingRef = useRef(false);

  const handleWithdraw = async () => {
    if (submittingRef.current) {
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const result = await withdrawAccountAction();
      if (result.status === "success") {
        window.location.replace("/");
        return;
      }
      setErrorMessage(result.message);
    } catch {
      setErrorMessage("회원탈퇴를 완료하지 못했습니다. 잠시 후 다시 시도해주세요.");
    }
    setConfirmOpen(false);
    submittingRef.current = false;
    setIsSubmitting(false);
  };

  return (
    <>
      <button
        type="button"
        className="px-3 py-2 text-xs font-bold text-red-500 underline underline-offset-2 transition-colors hover:text-red-600 active:text-red-700"
        disabled={isSubmitting}
        onClick={() => setConfirmOpen(true)}
      >
        회원탈퇴
      </button>
      <AppDialog
        open={confirmOpen}
        title="회원탈퇴 하시겠습니까?"
        description="탈퇴한 계정은 복구할 수 없습니다."
        role="alertdialog"
        dismissOnBackdrop={!isSubmitting}
        onClose={() => { if (!submittingRef.current) setConfirmOpen(false); }}
        actions={[
          { label: "취소", autoFocus: true, disabled: isSubmitting, onClick: () => setConfirmOpen(false) },
          { label: isSubmitting ? "탈퇴 중" : "회원탈퇴", variant: "danger", disabled: isSubmitting, onClick: handleWithdraw },
        ]}
      />
      <AppDialog
        open={Boolean(errorMessage)}
        title="확인해주세요"
        description={errorMessage}
        onClose={() => setErrorMessage("")}
        actions={[{ label: "확인", variant: "primary", onClick: () => setErrorMessage("") }]}
      />
    </>
  );
}
