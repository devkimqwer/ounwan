import { useEffect, useRef, useState } from "react";

import type { BankRecord, User } from "@/domain/models";
import { formatSystemDateTime } from "@/lib/date-format";
import { AppSubPageHeader, Avatar, getUserById } from "./shared-ui";

const BALANCE_RECORD_PAGE_SIZE = 5;

export function BalanceStatusView({ bankRecords, users, onBack }: { bankRecords: BankRecord[]; users: User[]; onBack: () => void }) {
  const [visibleCount, setVisibleCount] = useState(BALANCE_RECORD_PAGE_SIZE);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const detailHistoryActiveRef = useRef(false);
  const selectedRecordIdRef = useRef<string | null>(null);
  const visibleRecords = bankRecords.slice(0, visibleCount);
  const selectedRecord = bankRecords.find((record) => record.id === selectedRecordId);
  const hasMore = visibleCount < bankRecords.length;

  useEffect(() => {
    selectedRecordIdRef.current = selectedRecordId;
  }, [selectedRecordId]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const bankRecordDetailId = event.state?.ounwanBankRecordDetail as string | undefined;
      if (bankRecordDetailId) {
        detailHistoryActiveRef.current = true;
        selectedRecordIdRef.current = bankRecordDetailId;
        setSelectedRecordId(bankRecordDetailId);
        return;
      }

      if (detailHistoryActiveRef.current || selectedRecordIdRef.current) {
        detailHistoryActiveRef.current = false;
        selectedRecordIdRef.current = null;
        setSelectedRecordId(null);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const openRecordDetail = (recordId: string) => {
    detailHistoryActiveRef.current = true;
    selectedRecordIdRef.current = recordId;
    window.history.replaceState({ ounwanMorePage: "balance-status" }, "");
    window.history.pushState({ ounwanMorePage: "balance-status", ounwanBankRecordDetail: recordId }, "");
    setSelectedRecordId(recordId);
  };

  const closeRecordDetail = () => {
    if (detailHistoryActiveRef.current) {
      detailHistoryActiveRef.current = false;
      window.history.back();
      return;
    }

    selectedRecordIdRef.current = null;
    setSelectedRecordId(null);
  };

  if (selectedRecord) {
    return <BalanceRecordDetailView record={selectedRecord} users={users} onBack={closeRecordDetail} />;
  }

  return (
    <div className="min-h-full bg-slate-50">
      <AppSubPageHeader title="잔고 현황" onBack={onBack} />

      <div className="space-y-3 p-4">
        {visibleRecords.length > 0 ? (
          visibleRecords.map((record) => <BalanceRecordCard key={record.id} record={record} users={users} onOpen={() => openRecordDetail(record.id)} />)
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#F2F0FA] text-[#5e4ea5]">
              <BalanceIcon />
            </span>
            <h2 className="mt-4 text-base font-extrabold text-slate-950">등록된 잔고 현황이 없습니다.</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">총무가 잔고 이미지를 등록하면 이곳에 표시됩니다.</p>
          </section>
        )}

        {hasMore && (
          <button
            type="button"
            className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white text-sm font-extrabold text-slate-700 active:bg-slate-50"
            onClick={() => setVisibleCount((current) => current + BALANCE_RECORD_PAGE_SIZE)}
          >
            더보기
          </button>
        )}
      </div>
    </div>
  );
}

function BalanceRecordCard({ record, users, onOpen }: { record: BankRecord; users: User[]; onOpen: () => void }) {
  const user = getUserById(users, record.createdByUserId);
  const displayName = user?.name ?? "알 수 없는 사용자";

  return (
    <button type="button" className="block w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm shadow-slate-200/40 active:bg-slate-50" onClick={onOpen}>
      <BalanceRecordAuthor name={displayName} avatarUrl={user?.avatarUrl} createdAt={record.createdAt} />
      <BalanceRecordPreviewImage imageUrl={record.imageUrl} />
      {record.memo && <p className="mt-4 whitespace-pre-line break-words text-[15px] font-semibold leading-6 text-slate-700 line-clamp-3">{record.memo}</p>}
    </button>
  );
}

function BalanceRecordDetailView({ record, users, onBack }: { record: BankRecord; users: User[]; onBack: () => void }) {
  const user = getUserById(users, record.createdByUserId);
  const displayName = user?.name ?? "알 수 없는 사용자";

  return (
    <div className="min-h-full bg-slate-50">
      <AppSubPageHeader title="잔고 상세" onBack={onBack} />
      <div className="p-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40">
          <BalanceRecordAuthor name={displayName} avatarUrl={user?.avatarUrl} createdAt={record.createdAt} />
          <BalanceRecordDetailImage imageUrl={record.imageUrl} />
          {record.memo ? (
            <p className="mt-4 whitespace-pre-line break-words text-[15px] font-semibold leading-6 text-slate-700">{record.memo}</p>
          ) : (
            <p className="mt-4 text-sm font-semibold text-slate-400">입력된 내용이 없습니다.</p>
          )}
        </article>
      </div>
    </div>
  );
}

function BalanceRecordAuthor({ name, avatarUrl, createdAt }: { name: string; avatarUrl?: string; createdAt: string }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={name} imageUrl={avatarUrl} size="md" />
      <div className="min-w-0">
        <p className="truncate text-base font-extrabold text-slate-950">{name}</p>
        <p className="mt-0.5 text-xs font-semibold text-slate-400">{formatSystemDateTime(createdAt)}</p>
      </div>
    </div>
  );
}

function BalanceRecordPreviewImage({ imageUrl }: { imageUrl: string }) {
  return (
    <div className="mt-4 aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100">
      <img src={imageUrl} alt="잔고 현황 이미지" className="h-full w-full object-cover" loading="lazy" />
    </div>
  );
}

function BalanceRecordDetailImage({ imageUrl }: { imageUrl: string }) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl bg-slate-100">
      <img src={imageUrl} alt="잔고 현황 이미지" className="h-auto w-full object-contain" loading="lazy" />
    </div>
  );
}

function BalanceIcon() {
  return (
    <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16" />
      <path d="M4 10h16" />
      <path d="M4 14h10" />
      <path d="M4 18h8" />
    </svg>
  );
}