import { ReactNode } from "react";
import { ThemeToggle } from "@/components/design-system/theme-toggle";

interface PageContainerProps {
  children: ReactNode;
}

export function PageContainer({ children }: PageContainerProps) {
  return (
    <div className='relative flex min-h-screen items-center justify-center bg-background p-4 md:p-8'>
      <div className='absolute right-4 top-4'>
        <ThemeToggle />
      </div>
      <div className='w-full max-w-3xl'>
        <div className='rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8'>
          {children}
        </div>
      </div>
    </div>
  );
}
