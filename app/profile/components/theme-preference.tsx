"use client";

import * as React from "react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Auto" },
] as const;

/** Segmented Light / Dark / Auto control for the Profile settings card. */
export function ThemePreference() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Avoid hydration mismatch: theme is only known on the client.
  React.useEffect(() => setMounted(true), []);

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="bg-background border-border flex gap-0.5 rounded-full border p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = mounted && theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(option.value)}
            className={cn(
              "rounded-full px-3 py-1 text-xs transition-colors",
              active
                ? "bg-secondary text-foreground font-bold"
                : "text-muted-foreground font-semibold hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
