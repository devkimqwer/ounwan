import { useRef, useState } from "react";
import type { ReactNode } from "react";

import { AppDialog } from "@/components/ui/app-dialog";

export function MenuLogoutButton() {
  return (
    <LogoutConfirmButton
      renderButton={(openConfirm) => (
        <button
          type="button"
          className="flex min-h-12 w-full items-center justify-between p-3 text-left text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50 active:bg-slate-100"
          onClick={openConfirm}
        >
          <span className="inline-flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-600">
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
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
            </span>
            <span>로그아웃</span>
          </span>
          <svg
            aria-hidden="true"
            className="h-5 w-5 text-slate-300"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      )}
    />
  );
}

export function TextLogoutButton() {
  return (
    <LogoutConfirmButton
      renderButton={(openConfirm) => (
        <button
          type="button"
          className="px-3 py-2 text-xs font-bold text-slate-400 underline underline-offset-2 transition-colors hover:text-slate-600 active:text-slate-700"
          onClick={openConfirm}
        >
          로그아웃
        </button>
      )}
    />
  );
}

function LogoutConfirmButton({ renderButton }: { renderButton: (openConfirm: () => void) => ReactNode }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleLogout = () => {
    formRef.current?.requestSubmit();
  };

  return (
    <>
      <form ref={formRef} action="/api/auth/logout" method="post" />
      {renderButton(() => setConfirmOpen(true))}
      <AppDialog
        open={confirmOpen}
        title="로그아웃"
        description="로그아웃 하시겠습니까?"
        role="alertdialog"
        dismissOnBackdrop
        onClose={() => setConfirmOpen(false)}
        actions={[
          { label: "취소", onClick: () => setConfirmOpen(false) },
          { label: "로그아웃", variant: "primary", autoFocus: true, onClick: handleLogout },
        ]}
      />
    </>
  );
}
