import { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/design-system/app-shell";
import { createClient } from "@/lib/supabase/server";
import { canCoach } from "@/lib/roles";
import { isCommunityEnabled } from "@/lib/feature-flags";
import { CommunityTabs } from "./components/CommunityTabs";

export default async function CommunityLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Community is feature-flagged off (see lib/feature-flags.ts) — this
  // layout guards every /community/* page in one place.
  if (!isCommunityEnabled()) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let coachNav = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    coachNav = canCoach(profile?.role);
  }

  return (
    <AppShell coachNav={coachNav}>
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
