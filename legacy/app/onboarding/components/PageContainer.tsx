import { ReactNode } from "react";
import { AppShell } from "@/components/design-system/app-shell";

interface PageContainerProps {
  children: ReactNode;
}

export function PageContainer({ children }: PageContainerProps) {
  return (
    <AppShell>
      <div className='mx-auto w-full max-w-4xl'>{children}</div>
    </AppShell>
  );
}
