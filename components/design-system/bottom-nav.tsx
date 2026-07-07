"use client";

import * as React from "react";
import {
  Home,
  CalendarRange,
  Users,
  GraduationCap,
  CircleUser,
  UtensilsCrossed,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type NavKey =
  | "home"
  | "calendar"
  | "nutrition"
  | "community"
  | "coaching"
  | "profile";

/** Sentinel for routes that live under the IA but are not a tab (Programs
 * `/training`, the routine editor `/onboarding`). When it is the active value
 * no nav item matches, so the bar renders with nothing highlighted — these
 * routes are gateways reached from Calendar/Profile, not standalone tabs. */
export const NO_TAB = "__none__";

const ITEMS: {
  key: NavKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  // Single Time-first IA, shared by mobile + desktop. "Calendar" is the
  // gateway to the training programs + routine; "My programs" (/training) and
  // the routine editor (/onboarding) are reached from there and from Profile —
  // they are no longer standalone daily tabs.
  { key: "home", label: "Today", icon: Home },
  { key: "calendar", label: "Calendar", icon: CalendarRange },
  { key: "nutrition", label: "Meals", icon: UtensilsCrossed },
  { key: "community", label: "Community", icon: Users },
  { key: "coaching", label: "Coaching", icon: GraduationCap },
  { key: "profile", label: "Profile", icon: CircleUser },
];

interface BottomNavProps {
  active?: NavKey | typeof NO_TAB;
  onNavigate?: (key: NavKey) => void;
  /** Server pages set this from the viewer's role — no client role checks. */
  coachNav?: boolean;
  className?: string;
}

export function BottomNav({
  active = "home",
  onNavigate,
  coachNav = false,
  className,
}: BottomNavProps) {
  const items = coachNav
    ? ITEMS
    : ITEMS.filter((item) => item.key !== "coaching");

  return (
    <nav
      className={cn(
        "border-border bg-card/95 flex items-center justify-around border-t px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur",
        className,
      )}
      aria-label="Primary"
    >
      {items.map(({ key, label, icon: Icon }) => {
        const isActive = key === active;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onNavigate?.(key)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-w-16 flex-col items-center gap-0.5 rounded-md px-3 py-1 text-[11px] transition-colors",
              isActive
                ? "text-brand-ink font-bold"
                : "text-muted-foreground font-semibold",
            )}
          >
            <Icon className="size-5.5" aria-hidden />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
