import Image from "next/image";

import type { TabId } from "./app-types";
import { MenuLogoutButton } from "@/features/auth/logout-controls";

export function MainMenuPanel({
  open,
  userName,
  isAdmin,
  onClose,
  onSelect,
}: {
  open: boolean;
  userName: string;
  isAdmin: boolean;
  onClose: () => void;
  onSelect: (tabId: TabId) => void;
}) {
  return (
    <aside
      className={`fixed inset-0 z-[90] bg-white text-slate-950 transition-transform duration-300 ease-out ${
        open ? "pointer-events-auto translate-x-0" : "pointer-events-none -translate-x-full"
      }`}
      aria-hidden={!open}
    >
      <div className="mx-auto flex h-dvh min-h-dvh w-full max-w-screen-sm flex-col bg-white">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-100 px-5">
          <div className="h-10 w-10" aria-hidden="true" />
          <Image
            src="/assets/ounwan-logo-transparent-bg.png"
            alt="ounwan"
            width={122}
            height={28}
            priority
            className="h-3 w-auto object-contain"
          />
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full text-slate-900 transition-colors hover:bg-slate-100 active:bg-slate-200"
            aria-label="전체 메뉴 닫기"
            onClick={onClose}
          >
            <svg
              aria-hidden="true"
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <MainMenuSection
            title="메뉴"
            rows={[
              { label: "홈", onClick: () => onSelect("home") },
              { label: "피드", onClick: () => onSelect("feed") },
              { label: "인증", onClick: () => onSelect("cert") },
              { label: "캘린더", onClick: () => onSelect("calendar") },
              { label: "결산 내역", onClick: () => onSelect("more") },
              { label: "잔고 현황", onClick: () => onSelect("more") },
            ]}
          />

          <MainMenuSection
            title="총무"
            rows={[
              { label: "계좌 정보 관리", onClick: () => onSelect("more") },
              { label: "잔고 등록", onClick: () => onSelect("more") },
            ]}
          />

          {isAdmin && (
            <MainMenuSection
              title="관리자"
              rows={[
                { label: "시즌 관리", onClick: () => onSelect("more") },
                { label: "결산 관리", onClick: () => onSelect("more") },
                { label: "그룹 멤버 관리", onClick: () => onSelect("more") },
              ]}
            />
          )}
        </div>
        <div className="shrink-0 border-t border-slate-100 bg-white">
          <MenuLogoutButton />
        </div>
      </div>
    </aside>
  );
}

function MainMenuSection({ title, rows }: { title: string; rows: Array<{ label: string; onClick: () => void }> }) {
  return (
    <section className="mb-8 border-t border-dashed border-slate-300 pt-5 first:border-t-0 first:pt-0">
      <h2 className="mb-3 text-base font-extrabold tracking-normal text-slate-950">{title}</h2>
      <div className="space-y-1">
        {rows.map((row) => (
          <button
            key={row.label}
            type="button"
            className="flex min-h-11 w-full items-center justify-between rounded-lg px-1 text-left text-lg font-semibold text-slate-800 transition-colors hover:bg-[#F6F3FF] active:bg-[#EFE9FF]"
            onClick={row.onClick}
          >
            <span>{row.label}</span>
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
        ))}
      </div>
    </section>
  );
}
