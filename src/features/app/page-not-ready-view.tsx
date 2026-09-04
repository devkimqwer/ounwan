export function PageNotReadyView() {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <section className="flex w-full flex-col items-center rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[#F2F0FA] text-[#5e4ea5]">
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
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
          </svg>
        </span>
        <h1 className="mt-4 text-base font-extrabold text-slate-950">서비스 준비중입니다.</h1>
        <p className="mt-1 text-sm font-semibold text-slate-500">곧 사용할 수 있도록 준비하고 있습니다.</p>
      </section>
    </div>
  );
}