import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getMe } from "@/app/lib/me-data";
import { CommunityTabs } from "./components/community-tabs";

/** Community is feature-flagged (the API answers 404 while it's off). */
export default async function CommunityLayout({ children }: { children: ReactNode }) {
  const me = await getMe();
  if (!me?.features.community) redirect("/dashboard");
  return (
    <div className='mx-auto w-full max-w-5xl space-y-6'>
      <h1 className='text-foreground font-display text-2xl font-bold tracking-tight md:text-[28px]'>Community</h1>
      <div className='space-y-4'>
        <CommunityTabs />
        {children}
      </div>
    </div>
  );
}
