import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { getMe } from "@/app/lib/me-data";
import { prefetchProfile } from "@/app/lib/profile-data";
import { LogoutButton } from "./components/logout-button";
import { ProfileIdentity } from "./components/profile-identity";
import { ProfileTabContent } from "./components/profile-tab-content";
import { ProfileTabs } from "./components/profile-tabs";
import { resolveProfileTab } from "./lib/profile";

export const metadata: Metadata = { title: "Profile · CoachIn" };

type SearchParams = Promise<{ tab?: string | string[] }>;

export default async function ProfilePage({ searchParams }: { searchParams: SearchParams }) {
  const tab = resolveProfileTab((await searchParams).tab);
  const [me, state] = await Promise.all([getMe(), prefetchProfile(tab)]);
  return (
    <HydrationBoundary state={state}>
      <div className='mx-auto flex w-full max-w-4xl flex-col gap-6'>
        <div className='flex items-center gap-4'>
          <ProfileIdentity name={me?.fullName || me?.email || "You"} email={me?.email ?? ""} />
          <div className='hidden shrink-0 md:block'>
            <LogoutButton />
          </div>
        </div>
        <ProfileTabs active={tab} />
        <ProfileTabContent tab={tab} community={me?.features.community ?? false} />
      </div>
    </HydrationBoundary>
  );
}
