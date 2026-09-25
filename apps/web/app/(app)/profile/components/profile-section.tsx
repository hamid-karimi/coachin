import type { ReactNode } from "react";

/** An overline-titled block on the profile page. */
export function ProfileSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className='space-y-2.5'>
      <h2 className='text-overline'>{title}</h2>
      {children}
    </section>
  );
}
