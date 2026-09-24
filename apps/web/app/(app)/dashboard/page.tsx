import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getMe } from "@/app/lib/me-data";
import { ComingSoon } from "../components/coming-soon";

export const metadata: Metadata = { title: "Today · CoachIn" };

export default async function DashboardPage() {
  const me = await getMe();
  return (
    <ComingSoon
      title='Today'
      greeting={`Signed in as ${me?.fullName || me?.email}`}
      next='Your plan, streak, and XP arrive here with the dashboard module.'>
      <Button asChild variant='outline' className='self-start'>
        <Link href='/onboarding'>Edit my week</Link>
      </Button>
    </ComingSoon>
  );
}
