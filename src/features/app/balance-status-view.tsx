import { type ReactNode, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { deleteBankBalanceRecordAction } from "@/app/actions";
import { AppDialog } from "@/components/ui/app-dialog";
import type { BankRecord, User } from "@/domain/models";
import { formatSystemDateTime } from "@/lib/date-format";
import { BalanceRegistrationView } from "./balance-registration-view";
import { AppSubPageHeader, Avatar, getUserById } from "./shared-ui";

const BALANCE_RECORD_PAGE_SIZE = 5;

export function BalanceStatusView({ bankRecords, users, currentUserId, isTreasurer, onBack }: {
  bankRecords: BankRecord[];
  users: User[];
  currentUserId: string;
  isTreasurer: boolean;
  onBack: () => void;
}) {
  const router = useRouter();
  const [updatedRecords, setUpdatedRecords] = useState<Record<string, BankRecord>>({});
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [editingRecord, setEditingRecord] = useState<BankRecord | null>(null);
  const editingRef = useRef(false);
  const pendingUpdatedRecordRef = useRef<BankRecord | null>(null);
  const records = bankRecords.filter((record) => !deletedIds.includes(record.id)).map((record) => updatedRecords[record.id] ?? record);
  const [visibleCount, setVisibleCount] = useState(BALANCE_RECORD_PAGE_SIZE);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const detailHistoryActiveRef = useRef(false);
  const selectedRecordIdRef = useRef<string | null>(null);
  const visibleRecords = records.slice(0, visibleCount);
  const selectedRecord = records.find((record) => record.id === selectedRecordId);
  const hasMore = visibleCount < records.length;

  useEffect(() => {
    selectedRecordIdRef.current = selectedRecordId;
  }, [selectedRecordId]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (editingRef.current) {
        editingRef.current = false;
        setEditingRecord(null);
        const updated = pendingUpdatedRecordRef.current;
        pendingUpdatedRecordRef.current = null;
        if (updated && selectedRecordIdRef.current !== updated.id) {
          detailHistoryActiveRef.current = true;
          selectedRecordIdRef.current = updated.id;
          window.history.pushState({ ounwanMorePage: "balance-status", ounwanBankRecordDetail: updated.id }, "");
          setSelectedRecordId(updated.id);
        }
        return;
      }
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

  const openRecordEditor = (record: BankRecord) => {
    if (!isTreasurer || record.createdByUserId !== currentUserId || editingRef.current) {
      return;
    }
    editingRef.current = true;
    window.history.pushState({ ...window.history.state, ounwanMorePage: "balance-status", ounwanBankRecordEdit: record.id }, "");
    setEditingRecord(record);
  };

  const handleRecordDeleted = (recordId: string) => {
    setDeletedIds((previous) => [...previous, recordId]);
    if (selectedRecordIdRef.current === recordId) {
      closeRecordDetail();
    }
    router.refresh();
  };

  const renderMenu = (record: BankRecord) => isTreasurer && record.createdByUserId === currentUserId ? (
    <BalanceRecordMenu recordId={record.id} onEdit={() => openRecordEditor(record)} onDeleted={() => handleRecordDeleted(record.id)} />
  ) : null;

  if (editingRecord) {
    return (
      <BalanceRegistrationView
        key={editingRecord.id}
        recordToEdit={editingRecord}
        onBack={() => window.history.back()}
        onUpdated={(record) => {
          setUpdatedRecords((previous) => ({ ...previous, [record.id]: record }));
          pendingUpdatedRecordRef.current = record;
          window.history.back();
          router.refresh();
        }}
      />
    );
  }

  if (selectedRecord) {
    return <BalanceRecordDetailView record={selectedRecord} users={users} onBack={closeRecordDetail} menu={renderMenu(selectedRecord)} />;
  }

  return (
    <div className="min-h-full bg-slate-50">
      <AppSubPageHeader title="잔고 현황" onBack={onBack} />

      <div className="space-y-3 p-4">
        {visibleRecords.length > 0 ? (
          visibleRecords.map((record) => <BalanceRecordCard key={record.id} record={record} users={users} onOpen={() => openRecordDetail(record.id)} menu={renderMenu(record)} />)
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

function BalanceRecordCard({ record, users, onOpen, menu }: { record: BankRecord; users: User[]; onOpen: () => void; menu: ReactNode }) {
  const user = getUserById(users, record.createdByUserId);
  const displayName = user?.name ?? "알 수 없는 사용자";

  return (
    <article className="relative rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm shadow-slate-200/40">
      <button type="button" className="block w-full text-left active:bg-slate-50" onClick={onOpen}>
        <div className="pr-10"><BalanceRecordAuthor name={displayName} avatarUrl={user?.avatarUrl} createdAt={record.createdAt} /></div>
        <BalanceRecordPreviewImage imageUrl={record.imageUrl} />
        {record.memo && <p className="mt-4 whitespace-pre-line break-words text-[15px] font-semibold leading-6 text-slate-700 line-clamp-3">{record.memo}</p>}
      </button>
      <div className="absolute right-3 top-3">{menu}</div>
    </article>
  );
}

function BalanceRecordDetailView({ record, users, onBack, menu }: { record: BankRecord; users: User[]; onBack: () => void; menu: ReactNode }) {
  const user = getUserById(users, record.createdByUserId);
  const displayName = user?.name ?? "알 수 없는 사용자";

  return (
    <div className="min-h-full bg-slate-50">
      <AppSubPageHeader title="잔고 상세" onBack={onBack} />
      <div className="p-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40">
          <div className="flex items-center justify-between gap-2">
            <BalanceRecordAuthor name={displayName} avatarUrl={user?.avatarUrl} createdAt={record.createdAt} />
            {menu}
          </div>
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

function BalanceRecordMenu({ recordId, onEdit, onDeleted }: { recordId: string; onEdit: () => void; onDeleted: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleDelete = async () => {
    if (isDeleting) {
      return;
    }
    setIsDeleting(true);
    try {
      const result = await deleteBankBalanceRecordAction(recordId);
      if (result.status === "success") {
        onDeleted();
      } else {
        setErrorMessage(result.message);
      }
    } catch {
      setErrorMessage("잔고 현황을 삭제할 수 없습니다. 다시 시도해주세요.");
    } finally {
      setIsDeleting(false);
      setConfirmOpen(false);
    }
  };

  return (
    <>
      <button type="button" aria-label="잔고 게시글 더보기" className="grid h-10 w-10 shrink-0 place-items-center text-slate-500" onClick={() => setMenuOpen(true)}>
        <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
        </svg>
      </button>
      <AppDialog open={menuOpen} title="잔고 게시글" onClose={() => setMenuOpen(false)}>
        <button type="button" className="min-h-12 w-full text-left text-base text-slate-950" onClick={() => { setMenuOpen(false); onEdit(); }}>수정하기</button>
        <button type="button" className="min-h-12 w-full text-left text-base text-slate-950" onClick={() => { setMenuOpen(false); setConfirmOpen(true); }}>삭제하기</button>
      </AppDialog>
      <AppDialog
        open={confirmOpen}
        title="삭제하시겠습니까?"
        role="alertdialog"
        dismissOnBackdrop={!isDeleting}
        onClose={() => { if (!isDeleting) setConfirmOpen(false); }}
        actions={[
          { label: "취소", disabled: isDeleting, onClick: () => setConfirmOpen(false) },
          { label: isDeleting ? "삭제 중" : "삭제", variant: "primary", disabled: isDeleting, onClick: handleDelete },
        ]}
      />
      <AppDialog open={Boolean(errorMessage)} title="확인해주세요" description={errorMessage} onClose={() => setErrorMessage("")} actions={[{ label: "확인", variant: "primary", onClick: () => setErrorMessage("") }]} />
    </>
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
