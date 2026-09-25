import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/design-system/theme-toggle";
import type { ProfileTab } from "../lib/profile";
import { ActivityImportSection } from "./activity-import-section";
import { BodyProfileForm } from "./body-profile-form";
import { ChangePasswordForm } from "./change-password-form";
import { GoalsSection } from "./goals-section";
import { LogoutButton } from "./logout-button";
import { MeasurementsSection } from "./measurements-section";
import { NutritionSharingToggle } from "./nutrition-sharing-toggle";
import { ProfileSection } from "./profile-section";
import { ProfileStats } from "./profile-stats";
import { ProgressCharts } from "./progress-charts";
import { RecentXp } from "./recent-xp";
import { TrainingLinks } from "./training-links";

const TABS: Record<ProfileTab, () => ReactNode> = {
  overview: () => (
    <>
      <ProfileStats />
      <ProfileSection title='Goals'>
        <GoalsSection />
      </ProfileSection>
      <ProfileSection title='Training'>
        <TrainingLinks />
      </ProfileSection>
      <ProfileSection title='Recent XP'>
        <RecentXp />
      </ProfileSection>
    </>
  ),
  progress: () => (
    <>
      <ProfileSection title='Progress'>
        <ProgressCharts />
      </ProfileSection>
      <ProfileSection title='Measurements'>
        <MeasurementsSection />
      </ProfileSection>
    </>
  ),
  body: () => (
    <>
      <ProfileSection title='Body profile'>
        <BodyProfileForm />
      </ProfileSection>
      <ProfileSection title='Watch data'>
        <ActivityImportSection />
      </ProfileSection>
    </>
  ),
  settings: () => (
    <>
      <ProfileSection title='Settings'>
        <div className='bg-card border-border divide-border divide-y rounded-xl border px-4'>
          <div className='flex items-center justify-between gap-3 py-3'>
            <span className='text-foreground text-sm font-semibold'>Theme</span>
            <ThemeToggle />
          </div>
          <div className='py-3'>
            <NutritionSharingToggle />
          </div>
          <div className='flex items-center justify-between gap-3 py-3 md:hidden'>
            <span className='text-foreground text-sm font-semibold'>Account</span>
            <LogoutButton />
          </div>
        </div>
      </ProfileSection>
      <ProfileSection title='Password'>
        <div className='bg-card border-border rounded-xl border p-4 md:p-6'>
          <ChangePasswordForm />
        </div>
      </ProfileSection>
    </>
  ),
};

/** The sections of one profile tab. */
export function ProfileTabContent({ tab }: { tab: ProfileTab }) {
  return TABS[tab]();
}
