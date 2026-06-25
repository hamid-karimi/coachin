"use client";

import { useRouter } from "next/navigation";
import { ReactNode, useTransition, useState } from "react";
import { Loader2, Trophy, GraduationCap } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

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
  icon: typeof Trophy;
}[] = [
  {
    key: "leaderboards",
    href: "/community?tab=leaderboards&board=global",
    label: "Leaderboards",
    icon: Trophy,
  },
  {
    key: "coaching",
    href: "/community?tab=coaching",
    label: "Coaching",
    icon: GraduationCap,
  },
];

const BOARD_ITEMS: { key: ActiveBoard; label: string }[] = [
  { key: "global", label: "Global" },
  { key: "club", label: "My Club" },
  { key: "circle", label: "My Circle" },
];

function ContentSkeleton() {
  return (
    <div className='space-y-4 animate-pulse'>
      <div className='h-14 rounded-2xl bg-secondary' />
      <div className='h-28 rounded-2xl bg-secondary' />
      <div className='h-28 rounded-2xl bg-secondary' />
      <div className='h-20 rounded-2xl bg-secondary' />
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

  return (
    <div className='space-y-4'>
      {/* Main tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          if (value === activeTab) return;
          const target = TAB_ITEMS.find((item) => item.key === value);
          if (target) {
            navigate(target.href);
          }
        }}>
        <TabsList>
          {TAB_ITEMS.map((item) => {
            const Icon = item.icon;
            const loading = pendingTab === item.key && activeTab !== item.key;

            return (
              <TabsTrigger
                key={item.key}
                value={item.key}
                disabled={isPending}>
                {loading ? (
                  <Loader2 className='animate-spin' />
                ) : (
                  <Icon aria-hidden />
                )}
                {item.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Sub-board pills (leaderboards only) */}
      {activeTab === "leaderboards" && (
        <div className='flex flex-wrap gap-2'>
          {BOARD_ITEMS.map((item) => {
            const isActive = activeBoard === item.key;
            const loading =
              pendingBoard === item.key && activeBoard !== item.key;

            return (
              <Button
                key={item.key}
                type='button'
                size='sm'
                variant={isActive ? "brand" : "secondary"}
                disabled={isPending}
                onClick={() =>
                  navigate(`/community?tab=leaderboards&board=${item.key}`)
                }>
                {loading && <Loader2 className='animate-spin' />}
                {item.label}
              </Button>
            );
          })}
        </div>
      )}

      {/* Content: skeleton while pending, real content otherwise */}
      {isPending ? <ContentSkeleton /> : children}
    </div>
  );
}
