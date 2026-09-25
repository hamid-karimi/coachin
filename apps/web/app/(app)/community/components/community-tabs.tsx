"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, Trophy, UserPlus, UsersRound, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/community/boards", label: "Boards", icon: Trophy },
  { href: "/community/clubs", label: "Clubs", icon: Shield },
  { href: "/community/circle", label: "Circle", icon: UserPlus },
  { href: "/community/groups", label: "Groups", icon: UsersRound },
];

/** Pill tabs over the community segments. */
export function CommunityTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label='Community sections'
      className='border-border bg-background text-muted-foreground inline-flex h-10 w-full max-w-md items-center rounded-full border p-1'>
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname?.startsWith(href) ?? false;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-sm whitespace-nowrap transition-all [&_svg]:size-4",
              active ? "bg-secondary text-foreground font-bold" : "hover:text-foreground font-semibold",
            )}>
            <Icon aria-hidden className='hidden sm:block' />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
