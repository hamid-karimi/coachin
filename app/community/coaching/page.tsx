import Link from "next/link";
import { ArrowRight, GraduationCap } from "lucide-react";

import { canCoach, canStudy } from "@/lib/roles";
import { CoachesSection } from "../components/CoachesSection";
import { getCoachingData } from "../lib/coaching-data";

export const dynamic = "force-dynamic";

export default async function CoachingPage() {
  const { profileRole, coaches } = await getCoachingData();

  const viewerCanStudy = canStudy(profileRole);
  const viewerCanCoach = canCoach(profileRole);

  return (
    <section className='space-y-5'>
      {viewerCanStudy && (
        <CoachesSection coaches={coaches} canManage={viewerCanStudy} />
      )}

      {viewerCanCoach && (
        <Link
          href='/coaching'
          className='bg-card border-border hover:bg-secondary flex items-center gap-3 rounded-xl border p-4 transition-colors'>
          <span className='bg-brand-tint text-brand-ink grid size-10 shrink-0 place-items-center rounded-full'>
            <GraduationCap className='size-5' aria-hidden />
          </span>
          <span className='text-foreground min-w-0 flex-1 text-sm font-semibold'>
            Coaching tools live in your Coaching hub
          </span>
          <ArrowRight className='text-muted-foreground size-4 shrink-0' aria-hidden />
        </Link>
      )}

      {!viewerCanCoach && !viewerCanStudy && (
        <p className='text-muted-foreground text-sm'>
          Your current role has limited access to Coaching.
        </p>
      )}
    </section>
  );
}
