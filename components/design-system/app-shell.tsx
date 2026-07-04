"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import { AppSidebar, routeFor, keyFromPath } from "./app-sidebar";
import { BottomNav } from "./bottom-nav";

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Shared authenticated chrome: desktop sidebar + main content + mobile bottom nav.
 * The theme toggle lives in the sidebar (desktop) and on the Profile screen
 * (mobile), so page headers stay clean.
 */
export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const active = keyFromPath(pathname);

  return (
    <div className="flex min-h-screen">
      <AppSidebar />

      <main className="flex-1 px-4 py-6 pb-24 md:px-8 md:py-8 md:pb-8">
        {children}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 md:hidden">
        <BottomNav
          active={active}
          onNavigate={(key) => router.push(routeFor(key))}
        />
      </div>
    </div>
  );
}
