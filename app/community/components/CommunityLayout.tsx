import { ReactNode } from "react";
import { AppShell } from "@/components/design-system/app-shell";

interface CommunityLayoutProps {
  children: ReactNode;
}

export function CommunityLayout({ children }: CommunityLayoutProps) {
  return (
    <AppShell>
      <div className='mx-auto w-full max-w-5xl space-y-8' dir='ltr'>
        {children}
      </div>
    </AppShell>
  );
}
