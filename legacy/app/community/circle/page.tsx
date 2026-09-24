import { canStudy } from "@/lib/roles";
import { FriendsSection } from "../components/FriendsSection";
import { CoachesSection } from "../components/CoachesSection";
import { getCircleData } from "../lib/circle-data";
import { getCoachingData } from "../lib/coaching-data";

export const dynamic = "force-dynamic";

type CirclePageProps = {
  searchParams?: Promise<{
    q?: string;
    page?: string;
  }>;
};

export default async function CirclePage({ searchParams }: CirclePageProps) {
  const resolvedSearchParams = await searchParams;

  const [circle, coaching] = await Promise.all([
    getCircleData(
      resolvedSearchParams?.q,
      Number(resolvedSearchParams?.page ?? "1"),
    ),
    getCoachingData(),
  ]);

  return (
    <section className='space-y-5'>
      <FriendsSection
        followingProfiles={circle.followingProfiles}
        discoverProfiles={circle.discoverProfiles}
        followingUserIds={circle.followingUserIds}
        searchTerm={resolvedSearchParams?.q ?? ""}
      />

      {/* Trainee-side coaching lives with your people (the Coaching tab
          was removed; coach-side tools are in the /coaching hub). */}
      {canStudy(coaching.profileRole) && (
        <CoachesSection coaches={coaching.coaches} canManage />
      )}
    </section>
  );
}
