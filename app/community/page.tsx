import { CommunityLayout } from "./components/CommunityLayout";
import { ClubMembershipSection } from "./components/ClubMembershipSection";
import { CoachesSection } from "./components/CoachesSection";
import { FriendsSection } from "./components/FriendsSection";
import { LeaderboardSection } from "./components/LeaderboardSection";
import { StudentsSection } from "./components/StudentsSection";
import { getCommunityData } from "./lib/community-data";
import Link from "next/link";

export const dynamic = "force-dynamic";

type CommunityPageProps = {
  searchParams?: {
    tab?: string;
    board?: string;
    q?: string;
    page?: string;
  };
};

const COACH_ENABLED_ROLES = new Set(["coach", "both", "admin"]);
const STUDENT_ENABLED_ROLES = new Set(["student", "both", "admin"]);

export default async function CommunityPage({
  searchParams,
}: CommunityPageProps) {
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
    discoverPage,
    discoverHasNextPage,
  } = await getCommunityData(
    searchParams?.q,
    Number(searchParams?.page ?? "1"),
  );

  const activeTab =
    searchParams?.tab === "coaching" ? "coaching" : "leaderboards";
  const activeBoard =
    searchParams?.board === "club" || searchParams?.board === "circle"
      ? searchParams.board
      : "global";

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

      <nav className='flex flex-wrap gap-2'>
        <Link
          href='/community?tab=leaderboards&board=global'
          className={`px-4 py-2 rounded-xl text-sm font-medium ${
            activeTab === "leaderboards"
              ? "bg-blue-600 text-white"
              : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
          }`}>
          Leaderboards 🏆
        </Link>
        <Link
          href='/community?tab=coaching'
          className={`px-4 py-2 rounded-xl text-sm font-medium ${
            activeTab === "coaching"
              ? "bg-purple-600 text-white"
              : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
          }`}>
          Coaching Zone 🎓
        </Link>
      </nav>

      {activeTab === "leaderboards" && (
        <section className='space-y-4'>
          <div className='flex flex-wrap gap-2'>
            <Link
              href='/community?tab=leaderboards&board=global'
              className={`px-3 py-1.5 rounded-lg text-sm ${
                activeBoard === "global"
                  ? "bg-yellow-500 text-white"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
              }`}>
              Global League
            </Link>
            <Link
              href='/community?tab=leaderboards&board=club'
              className={`px-3 py-1.5 rounded-lg text-sm ${
                activeBoard === "club"
                  ? "bg-yellow-500 text-white"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
              }`}>
              My Club
            </Link>
            <Link
              href='/community?tab=leaderboards&board=circle'
              className={`px-3 py-1.5 rounded-lg text-sm ${
                activeBoard === "circle"
                  ? "bg-yellow-500 text-white"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
              }`}>
              My Circle
            </Link>
          </div>

          <LeaderboardSection
            leaderboard={
              leaderboardDataByBoard[
                activeBoard as "global" | "club" | "circle"
              ]
            }
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
            searchTerm={searchParams?.q ?? ""}
            discoverPage={discoverPage}
            discoverHasNextPage={discoverHasNextPage}
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
    </CommunityLayout>
  );
}
