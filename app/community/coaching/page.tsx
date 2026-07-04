import { CoachesSection } from "../components/CoachesSection";
import { LeaderboardSection } from "../components/LeaderboardSection";
import { StudentsSection } from "../components/StudentsSection";
import { getCoachingData } from "../lib/coaching-data";

export const dynamic = "force-dynamic";

const COACH_ENABLED_ROLES = new Set(["coach", "both", "admin"]);
const STUDENT_ENABLED_ROLES = new Set(["student", "both", "admin"]);

export default async function CoachingPage() {
  const {
    user,
    profileRole,
    coaches,
    students,
    coachStudentsLeaderboard,
    sportTypes,
    coachInviteCodes,
  } = await getCoachingData();

  const canCoach = COACH_ENABLED_ROLES.has(profileRole);
  const canStudy = STUDENT_ENABLED_ROLES.has(profileRole);

  return (
    <section className='space-y-5'>
      <div className='grid gap-5 lg:grid-cols-2'>
        {(canStudy || profileRole === "student") && (
          <CoachesSection coaches={coaches} canManage={canStudy} />
        )}
        {(canCoach || profileRole === "coach") && (
          <StudentsSection
            students={students}
            sportTypes={sportTypes}
            inviteCodes={coachInviteCodes}
            canManage={canCoach}
          />
        )}
      </div>

      {(canCoach || profileRole === "coach") && (
        <LeaderboardSection
          leaderboard={coachStudentsLeaderboard}
          currentUserId={user.id}
          title='My trainees'
          whatCounts='your trainees, ranked by total XP'
          emptyMessage='No trainees yet — share an invite code to connect.'
        />
      )}

      {!canCoach && !canStudy && (
        <p className='text-muted-foreground text-sm'>
          Your current role has limited access to Coaching.
        </p>
      )}
    </section>
  );
}
