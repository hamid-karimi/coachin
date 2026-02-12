import { ReactNode } from "react";

interface CommunityLayoutProps {
  children: ReactNode;
}

export function CommunityLayout({ children }: CommunityLayoutProps) {
  return (
    <div
      className='min-h-screen flex items-center justify-center bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4'
      dir='rtl'>
      <div className='w-full max-w-5xl'>
        <div className='bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-6 space-y-8'>
          {children}
        </div>
      </div>
    </div>
  );
}
