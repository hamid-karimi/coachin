"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy, GraduationCap, Shield, UserPlus, UsersRound } from "lucide-react";

import { cn } from "@/lib/utils";

const TAB_ITEMS: {
  href: string;
  label: string;
  icon: typeof Trophy;
}[] = [
  { href: "/community/boards", label: "Boards", icon: Trophy },
  { href: "/community/coaching", label: "Coaching", icon: GraduationCap },
  { href: "/community/clubs", label: "Clubs", icon: Shield },
  { href: "/community/circle", label: "Circle", icon: UserPlus },
  { href: "/community/groups", label: "Groups", icon: UsersRound },
];

export function CommunityTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label='Community sections'
      className='border-border bg-background text-muted-foreground inline-flex h-10 w-full max-w-md items-center justify-center rounded-full border p-1'>
      {TAB_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname?.startsWith(href) ?? false;

        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "focus-visible:ring-ring/40 inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-sm whitespace-nowrap transition-all outline-none focus-visible:ring-[3px] sm:px-4 [&_svg]:size-4",
              isActive
                ? "bg-secondary text-foreground font-bold"
                : "hover:text-foreground font-semibold",
            )}>
            <Icon aria-hidden className='hidden sm:block' />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
