"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Dumbbell,
  CalendarRange,
  Users,
  GraduationCap,
  CircleUser,
  UtensilsCrossed,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { isCommunityEnabled } from "@/lib/feature-flags";
import { ThemeToggle } from "./theme-toggle";
import { type NavKey } from "./bottom-nav";

/** Route map shared between the sidebar and the mobile bottom nav. */
export function routeFor(key: NavKey): string {
  switch (key) {
    case "home":
      return "/dashboard";
    case "training":
      return "/training";
    case "calendar":
      return "/calendar";
    case "nutrition":
      return "/nutrition";
    case "community":
      return "/community";
    case "coaching":
      return "/coaching";
    case "profile":
      return "/profile";
    default:
      return "/dashboard";
  }
}

/** Derive the active NavKey from the current pathname. Programs (/training) and
 * the routine editor (/onboarding) both belong to the Training surface, so they
 * highlight the Training tab. */
export function keyFromPath(pathname: string | null): NavKey {
  if (pathname?.startsWith("/training")) return "training";
  if (pathname?.startsWith("/onboarding")) return "training";
  if (pathname?.startsWith("/calendar")) return "calendar";
  if (pathname?.startsWith("/nutrition")) return "nutrition";
  if (pathname?.startsWith("/community")) return "community";
  if (pathname?.startsWith("/coaching")) return "coaching";
  if (pathname?.startsWith("/profile")) return "profile";
  return "home";
}

const ITEMS: {
  key: NavKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "home", label: "Today", icon: Home },
  { key: "training", label: "Training", icon: Dumbbell },
  { key: "calendar", label: "Calendar", icon: CalendarRange },
  { key: "nutrition", label: "Nutrition", icon: UtensilsCrossed },
  { key: "community", label: "Community", icon: Users },
  { key: "coaching", label: "Coaching", icon: GraduationCap },
  { key: "profile", label: "Profile", icon: CircleUser },
];

interface AppSidebarProps {
  /** Server pages set this from the viewer's role — no client role checks. */
  coachNav?: boolean;
  className?: string;
}

export function AppSidebar({ coachNav = false, className }: AppSidebarProps) {
  const pathname = usePathname();
  const active = keyFromPath(pathname);

  const items = ITEMS.filter(
    (item) =>
      (item.key !== "coaching" || coachNav) &&
      (item.key !== "community" || isCommunityEnabled()),
  );

  return (
    <aside
      className={cn(
        // Sticky + h-dvh: the sidebar fills exactly one viewport and stays
        // put while long pages scroll (it never stretches to page height).
        "border-border bg-card sticky top-0 hidden h-dvh md:flex md:w-[220px] md:shrink-0 md:flex-col gap-1.5 overflow-y-auto border-r p-4",
        className,
      )}
    >
      <Link
        href="/dashboard"
        className="mb-5 flex items-center gap-2.5 px-2 pt-1"
      >
        <span className="bg-brand text-brand-foreground grid size-8 place-items-center rounded-sm text-lg font-bold text-stat">
          C
        </span>
        <span className="text-foreground font-display text-base font-bold">
          CoachIn
        </span>
      </Link>

      <nav className="flex flex-col gap-1" aria-label="Primary">
        {items.map(({ key, label, icon: Icon }) => {
          const isActive = key === active;
          return (
            <Link
              key={key}
              href={routeFor(key)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                isActive
                  ? "bg-brand-tint text-brand-ink font-bold"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground font-semibold",
              )}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center justify-between px-2 pb-1">
        <span className="text-muted-foreground text-xs">Theme</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
