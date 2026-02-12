import { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
}

export function PageContainer({ children }: PageContainerProps) {
  return (
    <div
      className='min-h-screen flex items-center justify-center bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 text-right p-8'
      dir='rtl'>
      <div className='w-full max-w-2xl'>
        <div className='bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8'>
          {children}
        </div>
      </div>
    </div>
  );
}
