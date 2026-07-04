"use client";

import { useRouter } from "next/navigation";
import { ReactNode, useTransition, useState } from "react";
import {
  Loader2,
  Trophy,
  GraduationCap,
  Shield,
  UserPlus,
} from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type ActiveTab = "boards" | "coaching" | "clubs" | "circle";
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
    key: "boards",
    href: "/community?tab=boards&board=global",
    label: "Boards",
    icon: Trophy,
  },
  {
    key: "coaching",
    href: "/community?tab=coaching",
    label: "Coaching",
    icon: GraduationCap,
  },
  {
    key: "clubs",
    href: "/community?tab=clubs",
    label: "Clubs",
    icon: Shield,
  },
  {
    key: "circle",
    href: "/community?tab=circle",
    label: "Circle",
    icon: UserPlus,
  },
];

const BOARD_ITEMS: { key: ActiveBoard; label: string }[] = [
  { key: "global", label: "Global" },
  { key: "club", label: "My Club" },
  { key: "circle", label: "My Circle" },
];

function ContentSkeleton() {
  return (
    <div className='animate-pulse space-y-3'>
      <div className='bg-secondary h-11 rounded-md' />
      <div className='bg-secondary h-16 rounded-xl' />
      <div className='bg-secondary h-16 rounded-xl' />
      <div className='bg-secondary h-16 rounded-xl opacity-60' />
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
      ? (TAB_ITEMS.find((item) =>
          pendingHref.includes(`tab=${item.key}`),
        )?.key ?? null)
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
        <TabsList className='w-full max-w-md'>
          {TAB_ITEMS.map((item) => {
            const Icon = item.icon;
            const loading = pendingTab === item.key && activeTab !== item.key;

            return (
              <TabsTrigger
                key={item.key}
                value={item.key}
                disabled={isPending}
                className='px-2 sm:px-4'>
                {loading ? (
                  <Loader2 className='animate-spin' />
                ) : (
                  <Icon aria-hidden className='hidden sm:block' />
                )}
                {item.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Board pills (boards tab only) */}
      {activeTab === "boards" && (
        <div className='flex flex-wrap gap-2'>
          {BOARD_ITEMS.map((item) => {
            const isActive = activeBoard === item.key;
            const loading =
              pendingBoard === item.key && activeBoard !== item.key;

            return (
              <button
                key={item.key}
                type='button'
                disabled={isPending}
                onClick={() => navigate(`/community?tab=boards&board=${item.key}`)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[13px] transition-colors disabled:opacity-50",
                  isActive
                    ? "border-brand bg-brand text-brand-foreground font-bold"
                    : "border-border bg-secondary text-muted-foreground hover:text-foreground font-semibold",
                )}>
                {loading && <Loader2 className='size-3.5 animate-spin' />}
                {item.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Content: skeleton while pending, real content otherwise */}
      {isPending ? <ContentSkeleton /> : children}
    </div>
  );
}
