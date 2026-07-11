import Link from "next/link";
import { ChartLine, Settings, User, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";

export const PROFILE_TABS = ["overview", "progress", "body", "settings"] as const;
export type ProfileTab = (typeof PROFILE_TABS)[number];

/** Validate a ?tab= query value; anything unknown lands on overview. */
export function resolveProfileTab(raw: string | undefined): ProfileTab {
  return (PROFILE_TABS as readonly string[]).includes(raw ?? "")
    ? (raw as ProfileTab)
    : "overview";
}

const TAB_ITEMS: { tab: ProfileTab; label: string; icon: typeof User }[] = [
  { tab: "overview", label: "Overview", icon: User },
  { tab: "progress", label: "Progress", icon: ChartLine },
  { tab: "body", label: "Body", icon: UserRound },
  { tab: "settings", label: "Settings", icon: Settings },
];

/** Pill tab nav (CommunityTabs pattern) driven by the ?tab= query param so
 *  the page stays fully server-rendered — no client tab state. */
export function ProfileTabs({ active }: { active: ProfileTab }) {
  return (
    <nav
      aria-label="Profile sections"
      className="border-border bg-background text-muted-foreground inline-flex h-10 w-full max-w-md items-center justify-center rounded-full border p-1"
    >
      {TAB_ITEMS.map(({ tab, label, icon: Icon }) => {
        const isActive = tab === active;
        return (
          <Link
            key={tab}
            href={tab === "overview" ? "/profile" : `/profile?tab=${tab}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "focus-visible:ring-ring/40 inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-sm whitespace-nowrap transition-all outline-none focus-visible:ring-[3px] sm:px-4 [&_svg]:size-4",
              isActive
                ? "bg-secondary text-foreground font-bold"
                : "hover:text-foreground font-semibold",
            )}
          >
            <Icon aria-hidden className="hidden sm:block" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
