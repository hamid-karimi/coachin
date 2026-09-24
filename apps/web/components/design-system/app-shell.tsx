"use client";

import { usePathname } from "next/navigation";
import { keyFromPath, type NavVisibility } from "@/lib/nav";
import { AppSidebar } from "./app-sidebar";
import { BottomNav } from "./bottom-nav";

interface AppShellProps extends NavVisibility {
  children: React.ReactNode;
}

/**
 * Signed-in chrome: desktop sidebar, content, mobile bottom nav. The
 * visibility flags come from the server (role + GET /me), never from client
 * checks.
 */
export function AppShell({ children, coachNav, communityNav }: AppShellProps) {
  const active = keyFromPath(usePathname());
  return (
    <div className='flex min-h-screen'>
      <AppSidebar active={active} coachNav={coachNav} communityNav={communityNav} />
      <main className='flex-1 px-4 py-6 pb-24 md:px-8 md:py-8 md:pb-8'>{children}</main>
      <div className='fixed inset-x-0 bottom-0 z-40 md:hidden'>
        <BottomNav active={active} coachNav={coachNav} communityNav={communityNav} />
      </div>
    </div>
  );
}
