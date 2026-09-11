import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { updateBankAccountInfoAction } from "@/app/actions";
import type { UpdateBankAccountInfoState } from "@/app/actions";
import type { AccountInfo } from "@/domain/models";

import { AppDialog } from "@/components/ui/app-dialog";

const initialState: UpdateBankAccountInfoState = { status: "idle", message: "" };

type BankAccountManagementViewProps = {
  accountInfo: AccountInfo;
  onBack: () => void;
};

export function BankAccountManagementView({ accountInfo, onBack }: BankAccountManagementViewProps) {
  const router = useRouter();
  const [bankName, setBankName] = useState(toInputValue(accountInfo.bankName));
  const [holderName, setHolderName] = useState(toInputValue(accountInfo.holderName));
  const [accountNumber, setAccountNumber] = useState(toInputValue(accountInfo.accountNumber));
  const [state, setState] = useState<UpdateBankAccountInfoState>(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setBankName(toInputValue(accountInfo.bankName));
    setHolderName(toInputValue(accountInfo.holderName));
    setAccountNumber(toInputValue(accountInfo.accountNumber));
    setState(initialState);
  }, [accountInfo.accountNumber, accountInfo.bankName, accountInfo.holderName]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    setState(initialState);
    setIsSubmitting(true);

    try {
      const result = await updateBankAccountInfoAction(initialState, formData);
      setState(result);
      if (result.status === "success") {
        router.refresh();
      }
    } catch {
      setState({ status: "error", message: "계좌 정보를 저장할 수 없습니다." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <BankAccountManagementHeader onBack={onBack} />

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div>
          <h2 className="text-base font-extrabold text-slate-950">벌금 입금 계좌</h2>
          <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">멤버에게 표시될 입금 계좌 정보를 관리합니다.</p>
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-extrabold text-slate-700">은행 <span className="text-red-500" aria-hidden="true">*</span></span>
            <input
              name="bankName"
              value={bankName}
              maxLength={100}
              onChange={(event) => setBankName(event.target.value)}
              className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base font-bold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#5e4ea5] focus:ring-4 focus:ring-[#5e4ea5]/10"
              placeholder="예: 카카오뱅크"
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-extrabold text-slate-700">예금주 <span className="text-red-500" aria-hidden="true">*</span></span>
            <input
              name="holderName"
              value={holderName}
              maxLength={100}
              onChange={(event) => setHolderName(event.target.value)}
              className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base font-bold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#5e4ea5] focus:ring-4 focus:ring-[#5e4ea5]/10"
              placeholder="예: 홍길동"
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-extrabold text-slate-700">계좌번호 <span className="text-red-500" aria-hidden="true">*</span></span>
            <input
              name="accountNumber"
              value={accountNumber}
              maxLength={100}
              inputMode="text"
              onChange={(event) => setAccountNumber(event.target.value)}
              className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base font-bold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#5e4ea5] focus:ring-4 focus:ring-[#5e4ea5]/10"
              placeholder="예: 3333-12-3456789"
              required
            />
          </label>

          {state.message && <p className={`text-sm font-bold ${state.status === "error" ? "text-red-600" : "text-[#51438f]"}`}>{state.message}</p>}

          <button
            type="submit"
            disabled={isSubmitting || !bankName.trim() || !holderName.trim() || !accountNumber.trim()}
            className="min-h-12 w-full rounded-xl bg-slate-950 px-4 text-sm font-extrabold text-white active:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400"
          >
            {isSubmitting ? "저장 중" : "저장"}
          </button>
        </form>
      </section>

      <AppDialog
        open={state.status === "success"}
        title="저장 완료"
        description={state.message}
        onClose={() => setState(initialState)}
        dismissOnBackdrop
        actions={[{ label: "확인", onClick: () => setState(initialState) }]}
      />
    </div>
  );
}

function BankAccountManagementHeader({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <button type="button" className="grid h-10 w-10 place-items-center rounded-full text-slate-700 active:bg-slate-100" aria-label="뒤로가기" onClick={onBack}>
        <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <h1 className="text-base font-extrabold text-slate-950">계좌 정보 관리</h1>
      <div className="h-10 w-10" aria-hidden="true" />
    </div>
  );
}

function toInputValue(value: string) {
  return value === "미등록" ? "" : value;
}
