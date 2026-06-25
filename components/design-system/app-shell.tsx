"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import { AppSidebar, routeFor, keyFromPath } from "./app-sidebar";
import { BottomNav } from "./bottom-nav";
import { ThemeToggle } from "./theme-toggle";

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Shared authenticated chrome: desktop sidebar + main content + mobile bottom nav.
 * Reuses the presentational `BottomNav` as-is, wiring its `onNavigate` to the router.
 */
export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const active = keyFromPath(pathname);

  return (
    <div className="flex min-h-screen">
      <AppSidebar />

      <main className="flex-1 px-4 py-6 pb-20 md:px-8 md:pb-6">
        <div className="mb-4 flex justify-end">
          <ThemeToggle />
        </div>
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
