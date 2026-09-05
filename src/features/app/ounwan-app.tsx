"use client";
import Image from "next/image";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { OunwanAppData } from "@/domain/app-data";
import type { TabId } from "./app-types";
import { CertView } from "./cert-view";
import { FeedView } from "./feed-view";
import { HomeView } from "./home-view";
import { MainMenuPanel } from "./main-menu-panel";
import { MoreView } from "./more-view";
import { PostDetailView } from "./post-detail-view";
import { TabIcon } from "./tab-icon";
import { PageNotReadyView } from "./page-not-ready-view";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "home", label: "홈" },
  { id: "feed", label: "피드" },
  { id: "cert", label: "인증" },
  { id: "calendar", label: "캘린더" },
  { id: "more", label: "더보기" },
];
export function OunwanApp({ appData }: { appData: OunwanAppData }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [pendingCreatedPostId, setPendingCreatedPostId] = useState<string | null>(null);
  const detailHistoryActiveRef = useRef(false);
  const menuHistoryActiveRef = useRef(false);
  const tabHistoryActiveRef = useRef(false);
  const suppressNextPopRef = useRef(false);
  const pendingMenuSelectionRef = useRef<TabId | null>(null);
  const activeTabRef = useRef(activeTab);
  const menuOpenRef = useRef(menuOpen);
  const selectedPostIdRef = useRef(selectedPostId);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const listScrollTopRef = useRef(0);
  const { accountInfo, approvedGroups, currentUser, currentUserId, group, membership, posts, season, seasonParticipants, seasons, settlement, users } = appData;
  const roles = membership.roles;
  const isAdmin = roles.includes("admin");
  const isTreasurer = roles.includes("treasurer");
  const validPostCount = posts.filter((post) => !post.isInvalid).length;
  const selectedPost = posts.find((post) => post.id === selectedPostId);

  const restoreListScroll = () => {
    requestAnimationFrame(() => {
      contentScrollRef.current?.scrollTo({ top: listScrollTopRef.current });
    });
  };

  const closePostDetailFromHistory = () => {
    detailHistoryActiveRef.current = false;
    selectedPostIdRef.current = null;
    setSelectedPostId(null);
    restoreListScroll();
  };

  const closePostDetail = () => {
    if (detailHistoryActiveRef.current) {
      detailHistoryActiveRef.current = false;
      window.history.back();
      return;
    }

    closePostDetailFromHistory();
  };

  const openPostDetail = (postId: string) => {
    listScrollTopRef.current = contentScrollRef.current?.scrollTop ?? 0;
    detailHistoryActiveRef.current = true;
    window.history.pushState({ ounwanPostDetail: postId }, "");
    selectedPostIdRef.current = postId;
    setSelectedPostId(postId);
    requestAnimationFrame(() => {
      contentScrollRef.current?.scrollTo({ top: 0 });
    });
  };

  const openMenu = () => {
    if (menuOpenRef.current) {
      return;
    }

    menuHistoryActiveRef.current = true;
    window.history.pushState({ ounwanMenu: true }, "");
    menuOpenRef.current = true;
    setMenuOpen(true);
  };

  const closeMenuFromHistory = () => {
    menuHistoryActiveRef.current = false;
    menuOpenRef.current = false;
    setMenuOpen(false);
  };

  const closeMenu = () => {
    if (menuHistoryActiveRef.current) {
      menuHistoryActiveRef.current = false;
      suppressNextPopRef.current = true;
      window.history.back();
    }

    menuOpenRef.current = false;
    setMenuOpen(false);
  };

  const moveToTab = (tabId: TabId) => {
    selectedPostIdRef.current = null;
    setSelectedPostId(null);

    if (tabId === "home") {
      if (tabHistoryActiveRef.current) {
        tabHistoryActiveRef.current = false;
        suppressNextPopRef.current = true;
        window.history.back();
      }

      activeTabRef.current = "home";
      setActiveTab("home");
      requestAnimationFrame(() => {
        contentScrollRef.current?.scrollTo({ top: 0 });
      });
      return;
    }

    if (activeTabRef.current === "home" && !tabHistoryActiveRef.current) {
      tabHistoryActiveRef.current = true;
      window.history.pushState({ ounwanTab: tabId }, "");
    } else if (tabHistoryActiveRef.current) {
      window.history.replaceState({ ounwanTab: tabId }, "");
    }

    activeTabRef.current = tabId;
    setActiveTab(tabId);
  };

  const handlePostCreated = (postId: string) => {
    if (!tabHistoryActiveRef.current) {
      tabHistoryActiveRef.current = true;
      window.history.pushState({ ounwanTab: "feed" }, "");
    } else {
      window.history.replaceState({ ounwanTab: "feed" }, "");
    }

    activeTabRef.current = "feed";
    setActiveTab("feed");
    selectedPostIdRef.current = null;
    setSelectedPostId(null);
    setPendingCreatedPostId(postId);
    router.refresh();
  };

  const selectTab = (tabId: TabId) => {
    if (menuHistoryActiveRef.current) {
      pendingMenuSelectionRef.current = tabId;
      menuHistoryActiveRef.current = false;
      window.history.back();
      menuOpenRef.current = false;
      setMenuOpen(false);
      return;
    }

    if (detailHistoryActiveRef.current) {
      detailHistoryActiveRef.current = false;
      suppressNextPopRef.current = true;
      window.history.back();
    }

    moveToTab(tabId);
  };

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    menuOpenRef.current = menuOpen;
  }, [menuOpen]);

  useEffect(() => {
    selectedPostIdRef.current = selectedPostId;
  }, [selectedPostId]);

  useEffect(() => {
    const handlePopState = () => {
      const pendingMenuSelection = pendingMenuSelectionRef.current;
      if (pendingMenuSelection) {
        pendingMenuSelectionRef.current = null;
        closeMenuFromHistory();
        moveToTab(pendingMenuSelection);
        return;
      }

      if (suppressNextPopRef.current) {
        suppressNextPopRef.current = false;
        return;
      }

      if (detailHistoryActiveRef.current || selectedPostIdRef.current) {
        closePostDetailFromHistory();
        return;
      }

      if (menuHistoryActiveRef.current || menuOpenRef.current) {
        closeMenuFromHistory();
        return;
      }

      if (tabHistoryActiveRef.current || activeTabRef.current !== "home") {
        tabHistoryActiveRef.current = false;
        selectedPostIdRef.current = null;
        activeTabRef.current = "home";
        setSelectedPostId(null);
        setActiveTab("home");
        requestAnimationFrame(() => {
          contentScrollRef.current?.scrollTo({ top: 0 });
        });
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!pendingCreatedPostId || !posts.some((post) => post.id === pendingCreatedPostId)) {
      return;
    }

    openPostDetail(pendingCreatedPostId);
    setPendingCreatedPostId(null);
  }, [pendingCreatedPostId, posts]);

  return (
    <main className="min-h-dvh bg-slate-50 text-slate-950">
      <section className="mx-auto flex h-dvh min-h-dvh w-full max-w-screen-sm flex-col overflow-hidden bg-white">
        <header className="z-50 flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full text-slate-900 transition-colors hover:bg-slate-100 active:bg-slate-200"
            aria-label="전체 메뉴 열기"
            aria-expanded={menuOpen}
            onClick={openMenu}
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
          onClose={closeMenu}
          onSelect={(tabId) => {
            selectTab(tabId);
          }}
        />

        <div className="z-40 flex h-9 shrink-0 items-center justify-center border-b border-slate-200 bg-white">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold leading-none text-slate-500">
            {season.name} 진행중
          </span>
        </div>

        <div ref={contentScrollRef} className="min-h-0 flex-1 overflow-y-auto bg-slate-50 pb-4">
          {selectedPost ? (
            <PostDetailView
              post={selectedPost}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              users={users}
              onBack={closePostDetail}
            />
          ) : (
            <>
              {activeTab === "home" && (
                <HomeView
                  userName={currentUser.name}
                  currentUserId={currentUserId}
                  validPostCount={validPostCount}
                  targetCount={season.targetWorkoutCountPerWeek}
                  onCert={() => selectTab("cert")}
                  onFeed={() => selectTab("feed")}
                  onPostOpen={openPostDetail}
                  isAdmin={isAdmin}
                  posts={posts}
                  settlement={settlement}
                  users={users}
                />
              )}
              {activeTab === "feed" && (
                <FeedView
                  isAdmin={isAdmin}
                  posts={posts}
                  currentUserId={currentUserId}
                  users={users}
                  onPostOpen={openPostDetail}
                />
              )}
              {activeTab === "cert" && <CertView onPostCreated={handlePostCreated} />}
              {activeTab === "calendar" && (
                <PageNotReadyView />
              )}
              {activeTab === "more" && (
                <MoreView
                  isAdmin={isAdmin}
                  isTreasurer={isTreasurer}
                  currentUser={currentUser}
                  currentGroup={group}
                  approvedGroups={approvedGroups}
                  accountInfo={accountInfo}
                  seasons={seasons}
                  seasonParticipants={seasonParticipants}
                />
              )}
            </>
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
                onClick={() => selectTab(tab.id)}
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
