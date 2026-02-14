"use client";

import { useRouter } from "next/navigation";
import { ReactNode, useTransition, useState } from "react";

type ActiveTab = "leaderboards" | "coaching";
type ActiveBoard = "global" | "club" | "circle";

interface TabNavigationProps {
  activeTab: ActiveTab;
  activeBoard: ActiveBoard;
  children: ReactNode;
}

const TAB_ITEMS: {
  key: ActiveTab;
  href: string;
  label: string;
  activeClass: string;
}[] = [
  {
    key: "leaderboards",
    href: "/community?tab=leaderboards&board=global",
    label: "Leaderboards 🏆",
    activeClass: "bg-blue-600 text-white",
  },
  {
    key: "coaching",
    href: "/community?tab=coaching",
    label: "Coaching Zone 🎓",
    activeClass: "bg-purple-600 text-white",
  },
];

const BOARD_ITEMS: { key: ActiveBoard; label: string }[] = [
  { key: "global", label: "Global League" },
  { key: "club", label: "My Club" },
  { key: "circle", label: "My Circle" },
];

function Spinner() {
  return (
    <svg
      className='h-4 w-4 animate-spin'
      xmlns='http://www.w3.org/2000/svg'
      fill='none'
      viewBox='0 0 24 24'>
      <circle
        className='opacity-25'
        cx='12'
        cy='12'
        r='10'
        stroke='currentColor'
        strokeWidth='4'
      />
      <path
        className='opacity-75'
        fill='currentColor'
        d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z'
      />
    </svg>
  );
}

function ContentSkeleton() {
  return (
    <div className='space-y-4 animate-pulse'>
      <div className='h-14 rounded-2xl bg-slate-200 dark:bg-slate-700' />
      <div className='h-28 rounded-2xl bg-slate-200 dark:bg-slate-700' />
      <div className='h-28 rounded-2xl bg-slate-200 dark:bg-slate-700' />
      <div className='h-20 rounded-2xl bg-slate-200 dark:bg-slate-700' />
    </div>
  );
}

export function TabNavigation({
  activeTab,
  activeBoard,
  children,
}: TabNavigationProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const navigate = (url: string) => {
    setPendingHref(url);
    startTransition(() => {
      router.push(url);
    });
  };

  const pendingTab: ActiveTab | null =
    isPending && pendingHref
      ? pendingHref.includes("tab=coaching")
        ? "coaching"
        : "leaderboards"
      : null;

  const pendingBoard: ActiveBoard | null =
    isPending && pendingHref
      ? ((["global", "club", "circle"] as const).find((b) =>
          pendingHref.includes(`board=${b}`),
        ) ?? null)
      : null;

  const inactiveClass =
    "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200";

  return (
    <>
      {/* Main tabs */}
      <nav className='flex flex-wrap gap-2'>
        {TAB_ITEMS.map((item) => {
          const isActive = activeTab === item.key;
          const loading = pendingTab === item.key && activeTab !== item.key;

          return (
            <button
              key={item.key}
              onClick={() => navigate(item.href)}
              disabled={isPending}
              className={`px-4 py-2 rounded-xl text-sm font-medium inline-flex items-center gap-2 transition-colors disabled:opacity-80 ${
                isActive ? item.activeClass : inactiveClass
              }`}>
              {loading && <Spinner />}
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Sub-board tabs (leaderboards only) */}
      {activeTab === "leaderboards" && (
        <div className='flex flex-wrap gap-2'>
          {BOARD_ITEMS.map((item) => {
            const isActive = activeBoard === item.key;
            const loading =
              pendingBoard === item.key && activeBoard !== item.key;

            return (
              <button
                key={item.key}
                onClick={() =>
                  navigate(`/community?tab=leaderboards&board=${item.key}`)
                }
                disabled={isPending}
                className={`px-3 py-1.5 rounded-lg text-sm inline-flex items-center gap-1.5 transition-colors disabled:opacity-80 ${
                  isActive ? "bg-yellow-500 text-white" : inactiveClass
                }`}>
                {loading && <Spinner />}
                {item.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Content: skeleton while pending, real content otherwise */}
      {isPending ? <ContentSkeleton /> : children}
    </>
  );
}
