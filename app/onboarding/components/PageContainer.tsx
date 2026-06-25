import { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
}

export function PageContainer({ children }: PageContainerProps) {
  return (
    <div className='flex min-h-screen items-center justify-center bg-background p-4 md:p-8'>
      <div className='w-full max-w-3xl'>
        <div className='rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8'>
          {children}
        </div>
      </div>
    </div>
  );
}
