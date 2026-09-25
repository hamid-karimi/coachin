import Link from "next/link";
import { ChartLine, Settings, User, UserRound, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { profileTabHref, type ProfileTab } from "../lib/profile";

const TAB_ITEMS: { tab: ProfileTab; label: string; icon: LucideIcon }[] = [
  { tab: "overview", label: "Overview", icon: User },
  { tab: "progress", label: "Progress", icon: ChartLine },
  { tab: "body", label: "Body", icon: UserRound },
  { tab: "settings", label: "Settings", icon: Settings },
];

/** Pill tab nav driven by ?tab= so each tab stays server-rendered. */
export function ProfileTabs({ active }: { active: ProfileTab }) {
  return (
    <nav
      aria-label='Profile sections'
      className='border-border bg-background text-muted-foreground inline-flex h-10 w-full max-w-md items-center justify-center rounded-full border p-1'>
      {TAB_ITEMS.map(({ tab, label, icon: Icon }) => (
        <Link
          key={tab}
          href={profileTabHref(tab)}
          aria-current={tab === active ? "page" : undefined}
          className={cn(
            "focus-visible:ring-ring/40 inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-sm whitespace-nowrap transition-all outline-none focus-visible:ring-[3px] sm:px-4 [&_svg]:size-4",
            tab === active ? "bg-secondary text-foreground font-bold" : "hover:text-foreground font-semibold",
          )}>
          <Icon aria-hidden className='hidden sm:block' />
          {label}
        </Link>
      ))}
    </nav>
  );
}
