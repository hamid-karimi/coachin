import type { Metadata } from "next";
import { ThemeToggle } from "@/components/design-system/theme-toggle";
import { getMe } from "@/app/lib/me-data";
import { PageHeading } from "../components/page-heading";
import { ChangePasswordForm } from "./components/change-password-form";
import { LogoutButton } from "./components/logout-button";

export const metadata: Metadata = { title: "Profile · CoachIn" };

export default async function ProfilePage() {
  const me = await getMe();
  return (
    <div className='mx-auto flex max-w-3xl flex-col gap-8'>
      <div className='flex items-start justify-between gap-4'>
        <PageHeading title={me?.fullName || "Profile"} subtitle={me?.email} />
        <LogoutButton />
      </div>

      <section className='space-y-2.5'>
        <h2 className='text-overline'>Password</h2>
        <div className='bg-card border-border rounded-xl border p-4 md:p-6'>
          <ChangePasswordForm />
        </div>
      </section>

      <section className='space-y-2.5'>
        <h2 className='text-overline'>Settings</h2>
        <div className='bg-card border-border flex items-center justify-between gap-3 rounded-xl border px-4 py-3'>
          <span className='text-foreground text-sm font-semibold'>Theme</span>
          <ThemeToggle />
        </div>
      </section>
    </div>
  );
}
