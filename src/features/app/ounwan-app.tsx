"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { createWorkoutPostAction, deleteWorkoutPostAction } from "@/app/actions";
import { AppDialog } from "@/components/ui/app-dialog";
import type { CreateWorkoutPostState } from "@/app/actions";
import type { OunwanAppData } from "@/domain/app-data";
import type { AccountInfo, BankRecord, Settlement, SettlementRow, User, WorkoutPost } from "@/domain/models";

type TabId = "home" | "feed" | "cert" | "calendar" | "more";
type CertMediaPreview = {
  id: string;
  name: string;
  type: "image" | "video";
  url: string;
  file: File;
};

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "home", label: "홈" },
  { id: "feed", label: "피드" },
  { id: "cert", label: "인증" },
  { id: "calendar", label: "캘린더" },
  { id: "more", label: "더보기" },
];

export function OunwanApp({ appData }: { appData: OunwanAppData }) {
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);
  const { accountInfo, bankRecords, currentUserId, membership, posts, season, settlement, settlementRows, users } = appData;
  const currentUser = getUserById(users, currentUserId);
  const roles = membership.roles;
  const isAdmin = roles.includes("admin");
  const isTreasurer = roles.includes("treasurer");
  const validPostCount = posts.filter((post) => !post.isInvalid).length;

  return (
    <main className="min-h-dvh bg-slate-50 text-slate-950">
      <section className="mx-auto flex h-dvh min-h-dvh w-full max-w-screen-sm flex-col overflow-hidden bg-white">
        <header className="z-50 flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full text-slate-900 transition-colors hover:bg-slate-100 active:bg-slate-200"
            aria-label="전체 메뉴 열기"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <svg
              aria-hidden="true"
              className="h-[21px] w-[21px]"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              <path d="M3 5h12" />
              <path d="M3 9h12" />
              <path d="M3 13h12" />
            </svg>
          </button>
          <Image
            src="/assets/ounwan-logo-transparent-bg.png"
            alt="ounwan"
            width={122}
            height={28}
            priority
            className="h-3 w-auto object-contain"
          />
          <button type="button" className="relative grid h-10 w-10 place-items-center text-slate-900" aria-label="알림">
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
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#FF6B35]" />
          </button>
        </header>

        <MainMenuPanel
          open={menuOpen}
          userName={currentUser.name}
          isAdmin={isAdmin}
          isTreasurer={isTreasurer}
          onClose={() => setMenuOpen(false)}
          onSelect={(tabId) => {
            setActiveTab(tabId);
            setMenuOpen(false);
          }}
        />

        <div className="z-40 flex h-9 shrink-0 items-center justify-center border-b border-slate-200 bg-white">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold leading-none text-slate-500">
            {season.name} 진행중
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 pb-4">
          {activeTab === "home" && (
            <HomeView
              userName={currentUser.name}
              currentUserId={currentUserId}
              validPostCount={validPostCount}
              targetCount={season.targetWorkoutCountPerWeek}
              onCert={() => setActiveTab("cert")}
              onFeed={() => setActiveTab("feed")}
              isAdmin={isAdmin}
              posts={posts}
              settlement={settlement}
              users={users}
            />
          )}
          {activeTab === "feed" && (
            <FeedView
              mineOnly={mineOnly}
              onMineOnlyChange={setMineOnly}
              isAdmin={isAdmin}
              posts={posts}
              currentUserId={currentUserId}
              users={users}
            />
          )}
          {activeTab === "cert" && <CertView />}
          {activeTab === "calendar" && (
            <CalendarView currentUserId={currentUserId} isAdmin={isAdmin} posts={posts} users={users} />
          )}
          {activeTab === "more" && (
            <MoreView
              isAdmin={isAdmin}
              isTreasurer={isTreasurer}
              accountInfo={accountInfo}
              bankRecords={bankRecords}
              settlement={settlement}
              settlementRows={settlementRows}
            />
          )}
        </div>

        <nav className="z-40 grid shrink-0 grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
          {tabs.map((tab) => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 font-semibold ${
                  selected ? "text-[#5e4ea5]" : "text-slate-400"
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <TabIcon tabId={tab.id} />
                <span className="text-xs leading-none">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </section>
    </main>
  );
}

function MainMenuPanel({
  open,
  userName,
  isAdmin,
  isTreasurer,
  onClose,
  onSelect,
}: {
  open: boolean;
  userName: string;
  isAdmin: boolean;
  isTreasurer: boolean;
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
          <div className="mb-7">
            <p className="text-xl font-extrabold tracking-normal">오운완</p>
            <p className="mt-2 text-sm font-semibold text-slate-500">{userName}님</p>
          </div>

          <MainMenuSection
            title="메뉴"
            rows={[
              { label: "홈", onClick: () => onSelect("home") },
              { label: "피드", onClick: () => onSelect("feed") },
              { label: "인증", onClick: () => onSelect("cert") },
              { label: "캘린더", onClick: () => onSelect("calendar") },
            ]}
          />

          <MainMenuSection
            title="총무"
            rows={[
              { label: "계좌 정보 수정", onClick: () => onSelect("more") },
              { label: "통장 잔고 등록", onClick: () => onSelect("more") },
              { label: isTreasurer ? "정산 관리" : "정산 보기", onClick: () => onSelect("more") },
            ]}
          />

          {isAdmin && (
            <MainMenuSection
              title="관리자"
              rows={[
                { label: "시즌 관리", onClick: () => onSelect("more") },
                { label: "주간 결산 관리", onClick: () => onSelect("more") },
                { label: "멤버 승인 관리", onClick: () => onSelect("more") },
              ]}
            />
          )}
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
function TabIcon({ tabId }: { tabId: TabId }) {
  const commonProps = {
    className: "h-6 w-6",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (tabId === "home") {
    return (
      <svg {...commonProps}>
        <path d="m3 10 9-7 9 7" />
        <path d="M5 10v10h14V10" />
        <path d="M9 20v-6h6v6" />
      </svg>
    );
  }

  if (tabId === "feed") {
    return (
      <svg {...commonProps}>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M8 9h8" />
        <path d="M8 13h5" />
        <path d="M8 17h7" />
      </svg>
    );
  }

  if (tabId === "cert") {
    return (
      <svg {...commonProps}>
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
        <circle cx="12" cy="13" r="3" />
      </svg>
    );
  }

  if (tabId === "calendar") {
    return (
      <svg {...commonProps}>
        <rect x="3" y="4" width="18" height="17" rx="3" />
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <path d="M3 10h18" />
        <path d="M8 14h.01" />
        <path d="M12 14h.01" />
        <path d="M16 14h.01" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  );
}

function HomeView({
  userName,
  currentUserId,
  validPostCount,
  targetCount,
  onCert,
  onFeed,
  isAdmin,
  posts,
  settlement,
  users,
}: {
  userName: string;
  currentUserId: string;
  validPostCount: number;
  targetCount: number;
  onCert: () => void;
  onFeed: () => void;
  isAdmin: boolean;
  posts: WorkoutPost[];
  settlement: Settlement;
  users: User[];
}) {
  const recentPosts = posts.filter((post) => !post.isInvalid).slice(0, 2);
  const completedCount = Math.min(validPostCount, targetCount);
  const remainingCount = Math.max(targetCount - completedCount, 0);
  const progressPercent = targetCount > 0 ? (completedCount / targetCount) * 100 : 0;
  const weekRange = `${formatShortDate(settlement.weekStartDate)} ~ ${formatShortDate(settlement.weekEndDate)}`;

  return (
    <div className="space-y-4 p-4">
      <div className="px-1 pt-1">
        <p className="text-lg font-extrabold text-slate-950">좋은 하루, {userName}님 🖐️</p>
        <p className="mt-1 text-[13px] font-semibold text-slate-500">오늘도 오운완 가보자고!</p>
      </div>

      <button
        type="button"
        className="w-full rounded-2xl border border-[#CDC6E8] bg-[#F7F5FC] px-5 py-4 text-left text-[#51438f]"
        onClick={onCert}
      >
        <span className="block text-[13px] font-extrabold text-[#51438f]">오늘의 인증</span>
        <span className="mx-auto mt-3 grid h-28 w-28 place-items-center rounded-full border border-dashed border-[#BDB4DE] bg-white/80 text-slate-900">
          <span className="flex flex-col items-center gap-2">
            <svg
              aria-hidden="true"
              className="h-8 w-8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
              <circle cx="12" cy="13" r="3" />
            </svg>
            <span className="text-[13px] font-extrabold">인증하기</span>
          </span>
        </span>
      </button>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-extrabold text-slate-900">이번 주 나의 현황</h2>
          <span className="text-xs font-bold text-slate-400">{weekRange}</span>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <div className="flex flex-1 gap-2">
            {Array.from({ length: targetCount }, (_, index) => (
              <span
                key={index}
                className={`grid h-10 w-10 place-items-center rounded-full border text-base font-bold ${
                  index < completedCount
                    ? "border-[#5e4ea5] bg-[#5e4ea5] text-white"
                    : "border-slate-200 bg-white text-slate-300"
                }`}
              >
                ✓
              </span>
            ))}
          </div>
          <div className="shrink-0 text-right">
            <span className="text-2xl font-extrabold text-slate-950">{completedCount}</span>
            <span className="ml-1 text-lg font-extrabold text-slate-300">/ {targetCount}회</span>
          </div>
        </div>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-[#5e4ea5]" style={{ width: `${progressPercent}%` }} />
        </div>
        <p className="mt-3 text-[13px] font-bold text-slate-400">
          {remainingCount > 0
            ? `이번 주 ${remainingCount}회 더 인증하면 벌금이 없어요!`
            : "이번 주 목표를 달성했어요!"}
        </p>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-sm font-extrabold">최근 피드</h2>
          <button type="button" className="text-xs font-semibold text-[#5e4ea5]" onClick={onFeed}>
            전체보기
          </button>
        </div>
        <div className="space-y-3">
          {recentPosts.map((post) => (
            <PostCard key={post.id} post={post} currentUserId={currentUserId} isAdmin={isAdmin} users={users} />
          ))}
        </div>
      </section>
    </div>
  );
}

function formatShortDate(value: string) {
  const date = new Date(value);
  return `${date.getMonth() + 1}.${date.getDate()}`;
}

function FeedView({
  mineOnly,
  onMineOnlyChange,
  isAdmin,
  posts,
  currentUserId,
  users,
}: {
  mineOnly: boolean;
  onMineOnlyChange: (next: boolean) => void;
  isAdmin: boolean;
  posts: WorkoutPost[];
  currentUserId: string;
  users: User[];
}) {
  const visiblePosts = useMemo(
    () => posts.filter((post) => !mineOnly || post.userId === currentUserId),
    [currentUserId, mineOnly, posts],
  );

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-extrabold">피드</h2>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(event) => onMineOnlyChange(event.target.checked)}
          />
          내 인증만 보기
        </label>
      </div>
      {visiblePosts.map((post) => (
        <PostCard key={post.id} post={post} currentUserId={currentUserId} isAdmin={isAdmin} users={users} />
      ))}
    </div>
  );
}

function CertView() {
  const recentTypes = ["러닝", "헬스", "요가", "자전거", "수영"];
  const [workoutType, setWorkoutType] = useState("");
  const [mediaPreviews, setMediaPreviews] = useState<CertMediaPreview[]>([]);
  const [certMessageDialogOpen, setCertMessageDialogOpen] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const mediaPreviewsRef = useRef<CertMediaPreview[]>([]);
  const initialState: CreateWorkoutPostState = { status: "idle", message: "" };
  const [state, formAction, isPending] = useActionState(createWorkoutPostAction, initialState);

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
      const nextPreviews = [...previousPreviews, ...appendedPreviews];
      syncMediaInputFiles(nextPreviews);
      return nextPreviews;
    });
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
    <form action={formAction} className="space-y-4 p-4">
      <h2 className="text-base font-extrabold">운동 인증 등록</h2>
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
        <div className="grid grid-cols-3 gap-2">
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
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {recentTypes.map((type) => (
          <button
            key={type}
            type="button"
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold leading-none ${
              workoutType === type
                ? "border-[#5e4ea5] bg-[#5e4ea5] text-white"
                : "border-[#DDD8F1] bg-[#F2F0FA] text-[#51438f]"
            }`}
            onClick={() => setWorkoutType(type)}
          >
            {type}
          </button>
        ))}
      </div>
      <AppDialog
        open={certMessageDialogOpen && Boolean(state.message)}
        title={state.status === "success" ? "등록 완료" : "확인해주세요"}
        description={state.message}
        role="alertdialog"
        dismissOnBackdrop
        onClose={() => setCertMessageDialogOpen(false)}
        actions={[
          {
            label: "확인",
            variant: "primary",
            onClick: () => setCertMessageDialogOpen(false),
          },
        ]}
      />
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-2xl bg-slate-950 py-3.5 text-sm font-extrabold text-white disabled:bg-slate-300"
      >
        {isPending ? "등록 중" : "인증 등록"}
      </button>
    </form>
  );
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

function CalendarView({
  currentUserId,
  isAdmin,
  posts,
  users,
}: {
  currentUserId: string;
  isAdmin: boolean;
  posts: WorkoutPost[];
  users: User[];
}) {
  const days = Array.from({ length: 31 }, (_, index) => index + 1);
  const certifiedDays = new Set([14, 15, 17, 18]);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <button type="button" className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold">
          이전
        </button>
        <h2 className="text-[17px] font-extrabold">2026년 8월</h2>
        <button type="button" className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold">
          다음
        </button>
      </div>
      <div className="grid grid-cols-7 gap-2 rounded-2xl border border-slate-200 bg-white p-3">
        {days.map((day) => (
          <button
            key={day}
            type="button"
            className="relative grid aspect-square place-items-center rounded-xl text-[13px] font-semibold text-slate-700"
          >
            {day}
            {certifiedDays.has(day) && (
              <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-[#5e4ea5]" />
            )}
          </button>
        ))}
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold text-slate-400">8월 18일 인증</p>
        <div className="mt-3 space-y-3">
          {posts
            .filter((post) => post.workoutDate === "2026-08-18")
            .map((post) => (
              <PostCard key={post.id} post={post} currentUserId={currentUserId} isAdmin={isAdmin} users={users} />
            ))}
        </div>
      </section>
    </div>
  );
}

function MoreView({
  isAdmin,
  isTreasurer,
  accountInfo,
  bankRecords,
  settlement,
  settlementRows,
}: {
  isAdmin: boolean;
  isTreasurer: boolean;
  accountInfo: AccountInfo;
  bankRecords: BankRecord[];
  settlement: Settlement;
  settlementRows: SettlementRow[];
}) {
  const finalFineTotal = settlementRows.reduce((sum, row) => sum + row.finalFineAmount, 0);

  return (
    <div className="space-y-4 p-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-semibold text-slate-400">내 역할</p>
        <div className="mt-2 flex gap-2">
          {isAdmin && <Badge tone="green">관리자</Badge>}
          {isTreasurer && <Badge tone="amber">총무</Badge>}
          {!isAdmin && !isTreasurer && <Badge tone="slate">멤버</Badge>}
        </div>
      </section>
      <MenuBlock
        title="결산"
        rows={[
          `이번 주 결산: ${settlement.status === "draft" ? "미확정" : "확정"}`,
          `최종 벌금 합계: ${finalFineTotal.toLocaleString()}원`,
          `입금 계좌: ${accountInfo.bankName} ${accountInfo.accountNumber}`,
        ]}
      />
      <MenuBlock
        title="통장"
        rows={[
          `최근 잔고 등록 ${bankRecords.length}건`,
          isTreasurer ? "통장 잔고 등록/관리 가능" : "통장 잔고 조회만 가능",
        ]}
      />
      {isAdmin && (
        <MenuBlock
          title="관리"
          rows={["시즌 관리", "주간 결산 관리", "계좌 정보 수정"]}
        />
      )}
    </div>
  );
}

function PostCard({
  post,
  users,
  currentUserId,
  isAdmin = false,
  compact = false,
}: {
  post: WorkoutPost;
  users: User[];
  currentUserId?: string;
  isAdmin?: boolean;
  compact?: boolean;
}) {
  const user = getUserById(users, post.userId);
  const createdAt = new Date(post.createdAt);
  const createdAtText = formatPostDateTime(createdAt);
  const isOwnPost = currentUserId === post.userId;
  const canOpenPostMenu = isAdmin || isOwnPost;
  const adminMenuRef = useRef<HTMLDivElement>(null);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const router = useRouter();

  const handleDeletePostAction = async (formData: FormData) => {
    await deleteWorkoutPostAction(formData);
    setDeleteDialogOpen(false);
    router.refresh();
  };

  useEffect(() => {
    if (!adminMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!adminMenuRef.current?.contains(event.target as Node)) {
        setAdminMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [adminMenuOpen]);

  return (
    <article className="relative rounded-2xl border border-slate-200 bg-white">
      {post.isInvalid && (
        <div className="pointer-events-none absolute inset-0 z-10 rounded-2xl bg-white/55" aria-hidden="true" />
      )}
      <div className="flex items-center gap-3 p-4 pb-3">
        <Avatar name={user.name} color={user.avatarColor} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold">{user.name}</p>
            {post.isInvalid && <Badge tone="red">노인정</Badge>}
          </div>
          <p className="text-xs text-slate-400">
            {createdAtText}
          </p>
        </div>
        {canOpenPostMenu && (
          <div ref={adminMenuRef} className="relative z-30">
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full text-slate-500"
              aria-label="게시글 더보기"
              aria-expanded={adminMenuOpen}
              onClick={() => setAdminMenuOpen((open) => !open)}
            >
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
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </button>
            {adminMenuOpen && (
              <div className="absolute right-0 top-10 z-40 w-32 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {isAdmin && (
                  <button
                    type="button"
                    className="w-full px-4 py-3 text-left text-sm font-bold text-slate-950"
                    onClick={() => setAdminMenuOpen(false)}
                  >
                    {post.isInvalid ? "노인정 취소" : "노인정"}
                  </button>
                )}
                {isOwnPost && (
                  <button
                    type="button"
                    className="w-full px-4 py-3 text-left text-sm font-bold text-slate-950"
                    onClick={() => {
                      setAdminMenuOpen(false);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    삭제
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {!compact && (
        <div className="mx-4 aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100">
          {post.media[0]?.url && post.media[0].type === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.media[0].thumbnailUrl ?? post.media[0].url} alt="운동 인증" className="h-full w-full object-cover" />
          )}
          {post.media[0]?.url && post.media[0].type === "video" && (
            <video src={post.media[0].url} controls preload="metadata" className="h-full w-full object-cover" />
          )}
          {!post.media[0]?.url && (
            <div className="grid h-full place-items-center text-xs font-bold text-slate-400">이미지 없음</div>
          )}
        </div>
      )}
      <div className="space-y-3 p-4">
        {post.content && <p className="text-sm leading-5 text-slate-700">{post.content}</p>}
        <div>
          {post.workoutType && <Badge tone="green">{post.workoutType}</Badge>}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-bold text-slate-700"
              aria-label={`좋아요 ${post.likeCount}개`}
            >
              <span className="text-xl leading-none text-red-500" aria-hidden="true">♥</span>
              <span>{post.likeCount}</span>
            </button>
            <button
              type="button"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-bold text-slate-700"
              aria-label={`댓글 ${post.commentCount}개`}
            >
              <svg
                aria-hidden="true"
                className="h-5 w-5 text-slate-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
              </svg>
              <span>{post.commentCount}</span>
            </button>
          </div>
        </div>
      </div>
      <AppDialog
        open={deleteDialogOpen}
        title="게시글을 삭제할까요?"
        description="삭제한 게시글은 피드에서 보이지 않습니다."
        dismissOnBackdrop
        onClose={() => setDeleteDialogOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-950"
              onClick={() => setDeleteDialogOpen(false)}
            >
              취소
            </button>
            <form action={handleDeletePostAction}>
              <input type="hidden" name="postId" value={post.id} />
              <button type="submit" className="min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-extrabold text-white">
                삭제
              </button>
            </form>
          </>
        }
      />
    </article>
  );
}

function getUserById(users: User[], userId: string) {
  return users.find((user) => user.id === userId) ?? users[0];
}
function formatPostDateTime(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

function Avatar({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-extrabold text-white"
      style={{ backgroundColor: color }}
    >
      {name[0]}
    </span>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "green" | "amber" | "red" | "slate" }) {
  const className = {
    green: "bg-[#F2F0FA] text-[#51438f] border-[#DDD8F1]",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    red: "bg-red-50 text-red-600 border-red-100",
    slate: "bg-slate-100 text-slate-600 border-slate-200",
  }[tone];

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold leading-none ${className}`}>
      {children}
    </span>
  );
}

function MenuBlock({ title, rows }: { title: string; rows: string[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-extrabold">{title}</h2>
      {rows.map((row) => (
        <div key={row} className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 last:border-b-0">
          {row}
        </div>
      ))}
    </section>
  );
}
