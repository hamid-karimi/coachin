import Link from "next/link";

import { cn } from "@/lib/utils";
import { LeaderboardSection } from "../components/LeaderboardSection";
import { getBoardsData, type ActiveBoard } from "../lib/boards-data";

export const dynamic = "force-dynamic";

type BoardsPageProps = {
  searchParams?: Promise<{
    board?: string;
  }>;
};

const BOARD_ITEMS: { key: ActiveBoard; label: string }[] = [
  { key: "global", label: "Global" },
  { key: "club", label: "My Club" },
  { key: "circle", label: "My Circle" },
];

export default async function BoardsPage({ searchParams }: BoardsPageProps) {
  const resolvedSearchParams = await searchParams;

  const activeBoard: ActiveBoard =
    resolvedSearchParams?.board === "club" ||
    resolvedSearchParams?.board === "circle"
      ? resolvedSearchParams.board
      : "global";

  const { user, primaryClubName, followingUserIds, leaderboard } =
    await getBoardsData(activeBoard);

  const leaderboardTitleByBoard: Record<ActiveBoard, string> = {
    global: "Global",
    club: primaryClubName ? `My Club · ${primaryClubName}` : "My Club",
    circle: "My Circle",
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
    <div className='space-y-4'>
      {/* Board pills */}
      <div className='flex flex-wrap gap-2'>
        {BOARD_ITEMS.map((item) => {
          const isActive = activeBoard === item.key;

          return (
            <Link
              key={item.key}
              href={`/community/boards?board=${item.key}`}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[13px] transition-colors",
                isActive
                  ? "border-brand bg-brand text-brand-foreground font-bold"
                  : "border-border bg-secondary text-muted-foreground hover:text-foreground font-semibold",
              )}>
              {item.label}
            </Link>
          );
        })}
      </div>

      <LeaderboardSection
        leaderboard={leaderboard}
        currentUserId={user.id}
        title={leaderboardTitleByBoard[activeBoard]}
        whatCounts={whatCountsByBoard[activeBoard]}
        emptyMessage={leaderboardEmptyByBoard[activeBoard]}
        enableFollowActions
        followingUserIds={followingUserIds}
      />
    </div>
  );
}
