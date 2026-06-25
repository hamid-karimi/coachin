"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, Home, CalendarDays, Users, User } from "lucide-react";

import { cn } from "@/lib/utils";
import type { NavKey } from "./bottom-nav";

/** Route map shared between the sidebar and the mobile bottom nav. */
export function routeFor(key: NavKey): string {
  switch (key) {
    case "home":
      return "/dashboard";
    case "plan":
      return "/onboarding";
    case "community":
      return "/community";
    case "profile":
      // TODO: profile route — no dedicated profile page yet, fall back to dashboard.
      return "/dashboard";
  }
}

/** Derive the active NavKey from the current pathname. */
export function keyFromPath(pathname: string | null): NavKey {
  if (pathname?.startsWith("/onboarding")) return "plan";
  if (pathname?.startsWith("/community")) return "community";
  // /dashboard (and the unrouted profile) both resolve to home for now.
  return "home";
}

const ITEMS: {
  key: NavKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "plan", label: "Plan", icon: CalendarDays },
  { key: "community", label: "Community", icon: Users },
  { key: "profile", label: "Profile", icon: User },
];

interface AppSidebarProps {
  className?: string;
}

export function AppSidebar({ className }: AppSidebarProps) {
  const pathname = usePathname();
  const active = keyFromPath(pathname);

  return (
    <aside
      className={cn(
        "hidden md:flex md:w-[180px] md:shrink-0 md:flex-col gap-1 border-r border-border bg-card p-4",
        className,
      )}
    >
      <Link
        href="/dashboard"
        className="mb-6 flex items-center gap-2 px-2 text-lg font-bold text-brand"
      >
        <Flame className="size-5" aria-hidden />
        CoachIn
      </Link>

      <nav className="flex flex-col gap-1" aria-label="Primary">
        {ITEMS.map(({ key, label, icon: Icon }) => {
          const isActive = key === active;
          return (
            <Link
              key={key}
              href={routeFor(key)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-brand-tint text-brand-ink font-medium"
                  : "text-muted-foreground hover:bg-secondary",
              )}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
