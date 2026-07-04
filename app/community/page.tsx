import { CommunityLayout } from "./components/CommunityLayout";
import { ClubMembershipSection } from "./components/ClubMembershipSection";
import { CoachesSection } from "./components/CoachesSection";
import { FriendsSection } from "./components/FriendsSection";
import { LeaderboardSection } from "./components/LeaderboardSection";
import { StudentsSection } from "./components/StudentsSection";
import { TabNavigation } from "./components/TabNavigation";
import { getCommunityData } from "./lib/community-data";

export const dynamic = "force-dynamic";

type CommunityPageProps = {
  searchParams?: Promise<{
    tab?: string;
    board?: string;
    q?: string;
    page?: string;
  }>;
};

type ActiveTab = "boards" | "coaching" | "clubs" | "circle";
type ActiveBoard = "global" | "club" | "circle";

const COACH_ENABLED_ROLES = new Set(["coach", "both", "admin"]);
const STUDENT_ENABLED_ROLES = new Set(["student", "both", "admin"]);

function parseTab(tab?: string): ActiveTab {
  if (tab === "coaching" || tab === "clubs" || tab === "circle") return tab;
  // "leaderboards" is the legacy name for the boards tab.
  return "boards";
}

export default async function CommunityPage({
  searchParams,
}: CommunityPageProps) {
  const resolvedSearchParams = await searchParams;

  const activeTab = parseTab(resolvedSearchParams?.tab);
  const activeBoard: ActiveBoard =
    resolvedSearchParams?.board === "club" ||
    resolvedSearchParams?.board === "circle"
      ? resolvedSearchParams.board
      : "global";

  const {
    user,
    profileRole,
    coaches,
    students,
    coachStudentsLeaderboard,
    globalLeaderboard,
    myClubLeaderboard,
    myCircleLeaderboard,
    sportTypes,
    coachInviteCodes,
    clubMemberships,
    primaryClubName,
    followingUserIds,
    followingProfiles,
    discoverProfiles,
  } = await getCommunityData(
    resolvedSearchParams?.q,
    Number(resolvedSearchParams?.page ?? "1"),
    {
      activeTab,
      activeBoard,
    },
  );

  const canCoach = COACH_ENABLED_ROLES.has(profileRole);
  const canStudy = STUDENT_ENABLED_ROLES.has(profileRole);

  const leaderboardTitleByBoard: Record<ActiveBoard, string> = {
    global: "Global",
    club: primaryClubName ? `My Club · ${primaryClubName}` : "My Club",
    circle: "My Circle",
  };

  const leaderboardDataByBoard: Record<ActiveBoard, typeof globalLeaderboard> =
    {
      global: globalLeaderboard,
      club: myClubLeaderboard,
      circle: myCircleLeaderboard,
    };

  // "What counts" — make each board's rules explicit.
  const whatCountsByBoard: Record<ActiveBoard, string> = {
    global: "everyone on CoachIn",
    club: primaryClubName
      ? `members of ${primaryClubName} (your primary club)`
      : "members of your primary club",
    circle: "people you follow",
  };

  const leaderboardEmptyByBoard: Record<ActiveBoard, string> = {
    global: "No XP logged this week yet — log a workout to open the board.",
    club: primaryClubName
      ? "No club XP this week yet. Log a session to put your club on the board."
      : "Join a club to compete on a smaller board with people you know.",
    circle:
      "Follow a few people to unlock the Circle board — friendly rivalry works.",
  };

  return (
    <CommunityLayout>
      <header>
        <h1 className='text-foreground font-display text-2xl font-bold tracking-tight md:text-[28px]'>
          Community
        </h1>
      </header>

      <TabNavigation activeTab={activeTab} activeBoard={activeBoard}>
        {activeTab === "boards" && (
          <LeaderboardSection
            leaderboard={leaderboardDataByBoard[activeBoard]}
            currentUserId={user.id}
            title={leaderboardTitleByBoard[activeBoard]}
            whatCounts={whatCountsByBoard[activeBoard]}
            emptyMessage={leaderboardEmptyByBoard[activeBoard]}
            enableFollowActions
            followingUserIds={followingUserIds}
          />
        )}

        {activeTab === "coaching" && (
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
                title='My students'
                whatCounts='your students, ranked by total XP'
                emptyMessage='No students yet — share an invite code to connect.'
              />
            )}

            {!canCoach && !canStudy && (
              <p className='text-muted-foreground text-sm'>
                Your current role has limited access to Coaching.
              </p>
            )}
          </section>
        )}

        {activeTab === "clubs" && (
          <ClubMembershipSection memberships={clubMemberships} />
        )}

        {activeTab === "circle" && (
          <FriendsSection
            followingProfiles={followingProfiles}
            discoverProfiles={discoverProfiles}
            followingUserIds={followingUserIds}
            searchTerm={resolvedSearchParams?.q ?? ""}
          />
        )}
      </TabNavigation>
    </CommunityLayout>
  );
}
