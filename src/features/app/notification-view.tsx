import { useEffect, useRef, useState } from "react";

import { deleteNotificationAction, loadNotificationsAction, markNotificationsReadAction } from "@/app/actions";
import type { AppNotification, NotificationPage } from "@/domain/models";
import { formatSystemDateTime } from "@/lib/date-format";

export function NotificationView({
  initialPage,
  onBack,
  onOpenNotification,
  onUnreadCountChange,
}: {
  initialPage: NotificationPage;
  onBack: () => void;
  onOpenNotification: (notification: AppNotification) => void;
  onUnreadCountChange: (count: number) => void;
}) {
  const [notifications, setNotifications] = useState(initialPage.notifications);
  const [unreadCount, setUnreadCount] = useState(initialPage.unreadCount);
  const [nextOffset, setNextOffset] = useState(initialPage.nextOffset);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedUnreadCount = notifications.filter((notification) => selectedIds.includes(notification.id) && !notification.readAt).length;

  useEffect(() => {
    setNotifications(initialPage.notifications);
    setUnreadCount(initialPage.unreadCount);
    setNextOffset(initialPage.nextOffset);
    setSelectedIds([]);
    setOpenMenuId(null);
  }, [initialPage]);

  useEffect(() => {
    if (!openMenuId) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [openMenuId]);

  const updateUnreadCount = (nextCount: number) => {
    setUnreadCount(nextCount);
    onUnreadCountChange(nextCount);
  };

  const toggleSelected = (notificationId: string) => {
    setSelectedIds((current) =>
      current.includes(notificationId)
        ? current.filter((id) => id !== notificationId)
        : [...current, notificationId],
    );
  };

  const handleLoadMore = async () => {
    if (nextOffset === undefined || loadingMore) {
      return;
    }

    setLoadingMore(true);
    try {
      const page = await loadNotificationsAction(nextOffset);
      setNotifications((current) => [...current, ...page.notifications]);
      setNextOffset(page.nextOffset);
      updateUnreadCount(page.unreadCount);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleMarkRead = async () => {
    if (selectedIds.length === 0 || processing) {
      return;
    }

    setProcessing(true);
    try {
      await markNotificationsReadAction(selectedIds);
      setNotifications((current) =>
        current.map((notification) =>
          selectedIds.includes(notification.id) && !notification.readAt
            ? { ...notification, readAt: new Date().toISOString() }
            : notification,
        ),
      );
      setSelectedIds([]);
      updateUnreadCount(Math.max(unreadCount - selectedUnreadCount, 0));
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (notificationId: string) => {
    if (processing) {
      return;
    }

    const target = notifications.find((notification) => notification.id === notificationId);
    setProcessing(true);
    try {
      await deleteNotificationAction(notificationId);
      setNotifications((current) => current.filter((notification) => notification.id !== notificationId));
      setSelectedIds((current) => current.filter((id) => id !== notificationId));
      setOpenMenuId(null);
      if (target && !target.readAt) {
        updateUnreadCount(Math.max(unreadCount - 1, 0));
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleOpen = async (notification: AppNotification) => {
    if (!notification.readAt) {
      await markNotificationsReadAction([notification.id]);
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item,
        ),
      );
      updateUnreadCount(Math.max(unreadCount - 1, 0));
    }

    onOpenNotification(notification);
  };

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-900"
            aria-label="이전 화면으로 돌아가기"
            onClick={onBack}
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
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <h2 className="text-[17px] font-extrabold">알림</h2>
        </div>
        <button
          type="button"
          disabled={selectedIds.length === 0 || processing}
          className="min-h-9 rounded-xl bg-slate-950 px-3 text-xs font-extrabold text-white disabled:bg-slate-300"
          onClick={handleMarkRead}
        >
          읽음 처리
        </button>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white">
        {notifications.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {notifications.map((notification) => {
              const selected = selectedIds.includes(notification.id);
              const unread = !notification.readAt;
              return (
                <article key={notification.id} className="flex gap-3 px-4 py-3">
                  <button
                    type="button"
                    className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-md border text-[11px] font-extrabold ${
                      selected ? "border-[#5e4ea5] bg-[#5e4ea5] text-white" : "border-slate-300 bg-white text-transparent"
                    }`}
                    aria-label="알림 선택"
                    aria-pressed={selected}
                    onClick={() => toggleSelected(notification.id)}
                  >
                    ✓
                  </button>
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => handleOpen(notification)}>
                    <span className="flex items-center gap-2">
                      {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF6B35]" aria-label="읽지 않음" />}
                      <span className={`text-sm ${unread ? "font-extrabold text-slate-950" : "font-semibold text-slate-600"}`}>
                        {notification.message}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs font-semibold text-slate-400">{formatSystemDateTime(notification.createdAt)}</span>
                  </button>
                  <div ref={openMenuId === notification.id ? menuRef : undefined} className="relative shrink-0">
                    <button
                      type="button"
                      className="grid h-8 w-8 place-items-center rounded-full text-slate-400 active:bg-slate-100"
                      aria-label="알림 메뉴"
                      onClick={() => setOpenMenuId((current) => (current === notification.id ? null : notification.id))}
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
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="19" cy="12" r="1" />
                        <circle cx="5" cy="12" r="1" />
                      </svg>
                    </button>
                    {openMenuId === notification.id && (
                      <div className="absolute right-0 top-9 z-10 w-24 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                        <button
                          type="button"
                          className="min-h-9 w-full rounded-lg px-2 text-left text-sm font-bold text-red-500 active:bg-red-50"
                          onClick={() => handleDelete(notification.id)}
                        >
                          삭제
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="px-4 py-12 text-center text-sm font-semibold text-slate-400">도착한 알림이 없습니다.</p>
        )}
      </section>

      {nextOffset !== undefined && (
        <button
          type="button"
          disabled={loadingMore}
          className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white text-sm font-extrabold text-slate-700 disabled:text-slate-300"
          onClick={handleLoadMore}
        >
          {loadingMore ? "불러오는 중" : "더보기"}
        </button>
      )}
    </div>
  );
}