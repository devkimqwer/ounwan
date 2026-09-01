"use client";

import { useId } from "react";
import type { PointerEvent, ReactNode } from "react";

type AppDialogAction = {
  label: string;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  autoFocus?: boolean;
  disabled?: boolean;
};

type AppDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  actions?: AppDialogAction[];
  role?: "dialog" | "alertdialog";
  dismissOnBackdrop?: boolean;
  onClose?: () => void;
};

const actionClassNames = {
  primary: "bg-slate-950 text-white",
  secondary: "border border-slate-200 bg-white text-slate-950",
  danger: "bg-slate-950 text-white",
};

export function AppDialog({
  open,
  title,
  description,
  children,
  footer,
  actions,
  role = "dialog",
  dismissOnBackdrop = true,
  onClose,
}: AppDialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  if (!open) {
    return null;
  }

  const handleBackdropPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!dismissOnBackdrop || event.target !== event.currentTarget) {
      return;
    }

    onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-5"
      role="presentation"
      onPointerDown={handleBackdropPointerDown}
    >
      <section
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="w-full max-w-[320px] rounded-2xl bg-white p-5 shadow-xl"
      >
        <h2 id={titleId} className="text-base font-extrabold leading-6 text-slate-950">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="mt-2 text-sm font-semibold leading-5 text-slate-500">
            {description}
          </p>
        )}
        {children && <div className="mt-4 text-sm leading-5 text-slate-700">{children}</div>}
        {(footer || actions?.length) && (
          <div className="mt-5 flex justify-end gap-2">
            {footer ??
              actions?.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  autoFocus={action.autoFocus}
                  disabled={action.disabled}
                  className={`min-h-11 rounded-xl px-4 text-sm font-extrabold disabled:bg-slate-200 disabled:text-slate-400 ${
                    actionClassNames[action.variant ?? "secondary"]
                  }`}
                  onClick={action.onClick}
                >
                  {action.label}
                </button>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}