"use client";

import * as React from "react";
import { Home, CalendarDays, Users, User } from "lucide-react";

import { cn } from "@/lib/utils";

export type NavKey = "home" | "plan" | "community" | "profile";

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

interface BottomNavProps {
  active?: NavKey;
  onNavigate?: (key: NavKey) => void;
  className?: string;
}

export function BottomNav({
  active = "home",
  onNavigate,
  className,
}: BottomNavProps) {
  return (
    <nav
      className={cn(
        "flex items-center justify-around border-t border-border bg-card p-2.5",
        className,
      )}
      aria-label="Primary"
    >
      {ITEMS.map(({ key, label, icon: Icon }) => {
        const isActive = key === active;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onNavigate?.(key)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-md px-3 py-1 text-[11px] transition-colors",
              isActive ? "text-brand" : "text-muted-foreground",
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
