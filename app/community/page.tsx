import { CommunityLayout } from "./components/CommunityLayout";
import { ClubMembershipSection } from "./components/ClubMembershipSection";
import { CoachesSection } from "./components/CoachesSection";
import { FriendsSection } from "./components/FriendsSection";
import { LeaderboardSection } from "./components/LeaderboardSection";
import { StudentsSection } from "./components/StudentsSection";
import { TabNavigation } from "./components/TabNavigation";
import { getCommunityData } from "./lib/community-data";
import Link from "next/link";

export const dynamic = "force-dynamic";

type CommunityPageProps = {
  searchParams?: Promise<{
    tab?: string;
    board?: string;
    q?: string;
    page?: string;
  }>;
};

type ActiveTab = "leaderboards" | "coaching";
type ActiveBoard = "global" | "club" | "circle";

const COACH_ENABLED_ROLES = new Set(["coach", "both", "admin"]);
const STUDENT_ENABLED_ROLES = new Set(["student", "both", "admin"]);

export default async function CommunityPage({
  searchParams,
}: CommunityPageProps) {
  const resolvedSearchParams = await searchParams;

  const activeTab: ActiveTab =
    resolvedSearchParams?.tab === "coaching" ? "coaching" : "leaderboards";
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

  const metadata =
    (user.user_metadata as { full_name?: string; name?: string }) ?? {};
  const displayName = metadata.full_name || metadata.name || user.email;

  const leaderboardTitleByBoard: Record<string, string> = {
    global: "🏆 Global League",
    club: `🏟️ My Club${primaryClubName ? ` · ${primaryClubName}` : ""}`,
    circle: "👥 My Circle",
  };

  const leaderboardDataByBoard = {
    global: globalLeaderboard,
    club: myClubLeaderboard,
    circle: myCircleLeaderboard,
  };

  const leaderboardEmptyByBoard: Record<string, string> = {
    global: "هنوز رکوردی برای این هفته ثبت نشده است.",
    club: "برای کلاب اصلی شما هنوز رکوردی ثبت نشده است.",
    circle: "برای My Circle هنوز داده‌ای ثبت نشده است.",
  };

  return (
    <CommunityLayout>
      <header className='text-right space-y-1'>
        <p className='text-sm text-slate-500 dark:text-slate-400'>
          سلام، {displayName}!
        </p>
        <h1 className='text-3xl font-bold text-slate-900 dark:text-white'>
          جامعه ورزشی 🌍
        </h1>
        <p className='text-sm text-slate-500 dark:text-slate-400'>
          لیدربردها و فضای مربیگری رو اینجا مدیریت کن.
        </p>
      </header>

      <TabNavigation activeTab={activeTab} activeBoard={activeBoard}>
        {activeTab === "leaderboards" && (
          <section className='space-y-4'>
            <LeaderboardSection
              leaderboard={leaderboardDataByBoard[activeBoard]}
              currentUserId={user.id}
              title={leaderboardTitleByBoard[activeBoard]}
              emptyMessage={leaderboardEmptyByBoard[activeBoard]}
              enableFollowActions
              followingUserIds={followingUserIds}
            />

            <ClubMembershipSection memberships={clubMemberships} />

            <FriendsSection
              followingProfiles={followingProfiles}
              discoverProfiles={discoverProfiles}
              followingUserIds={followingUserIds}
              searchTerm={resolvedSearchParams?.q ?? ""}
            />
          </section>
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
              <div className='space-y-4'>
                <LeaderboardSection
                  leaderboard={coachStudentsLeaderboard}
                  currentUserId={user.id}
                  title='📈 لیدربرد داخلی شاگردها'
                  emptyMessage='هنوز شاگردی برای رتبه‌بندی وجود ندارد.'
                />

                <div className='flex justify-end'>
                  <Link
                    href='/dashboard'
                    className='rounded-xl bg-indigo-600 text-white px-4 py-2 text-sm font-medium'>
                    Create Workout for Student
                  </Link>
                </div>
              </div>
            )}
          </section>
        )}

        {!canCoach && !canStudy && (
          <p className='text-sm text-amber-600 dark:text-amber-400'>
            نقش فعلی شما برای بخش Coaching محدود است.
          </p>
        )}
      </TabNavigation>
    </CommunityLayout>
  );
}
