import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMe } from "@/app/lib/me-data";
import { canCoach } from "@/lib/roles";
import { ComingSoon } from "../components/coming-soon";

export const metadata: Metadata = { title: "Coaching · CoachIn" };

export default async function CoachingPage() {
  const me = await getMe();
  if (!canCoach(me?.role)) redirect("/dashboard");
  return (
    <ComingSoon
      title='Coaching'
      greeting={`Signed in as ${me?.fullName || me?.email}`}
      next='Your trainees and their weeks arrive here with the coaching module.'
    />
  );
}
