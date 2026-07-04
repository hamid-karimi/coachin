import { ReactNode } from "react";

import { AppShell } from "@/components/design-system/app-shell";
import { CommunityTabs } from "./components/CommunityTabs";

export default function CommunityLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AppShell>
      <div className='mx-auto w-full max-w-5xl space-y-8' dir='ltr'>
        <header>
          <h1 className='text-foreground font-display text-2xl font-bold tracking-tight md:text-[28px]'>
            Community
          </h1>
        </header>

        <div className='space-y-4'>
          <CommunityTabs />
          {children}
        </div>
      </div>
    </AppShell>
  );
}
