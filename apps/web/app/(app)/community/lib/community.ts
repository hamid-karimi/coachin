import type { components } from "@/lib/api/schema";

export type Leaderboard = components["schemas"]["LeaderboardBody"];
export type Board = Leaderboard["board"];
export type ClubMembership = components["schemas"]["ClubMembershipBody"];

export const BOARDS: { key: Board; label: string }[] = [
  { key: "global", label: "Global" },
  { key: "club", label: "My Club" },
  { key: "circle", label: "My Circle" },
];

/** A ?board= value; anything unknown is the global board. */
export function resolveBoard(raw: string | string[] | undefined): Board {
  return raw === "club" || raw === "circle" ? raw : "global";
}

export function boardHref(board: Board): string {
  return board === "global" ? "/community/boards" : `/community/boards?board=${board}`;
}

const TITLES: Record<Board, (club?: string) => string> = {
  global: () => "Global",
  club: (club) => (club ? `My Club · ${club}` : "My Club"),
  circle: () => "My Circle",
};

const WHAT_COUNTS: Record<Board, (club?: string) => string> = {
  global: () => "everyone on CoachIn",
  club: (club) => (club ? `members of ${club} (your primary club)` : "members of your primary club"),
  circle: () => "people you follow",
};

const EMPTY: Record<Board, (club?: string) => string> = {
  global: () => "No XP logged this week yet — log a workout to open the board.",
  club: (club) =>
    club
      ? "No club XP this week yet. Log a session to put your club on the board."
      : "Join a club to compete on a smaller board with people you know.",
  circle: () => "Follow a few people to unlock the Circle board — friendly rivalry works.",
};

/** Title, rules line, and empty message for a board. */
export function boardCopy(lb: Pick<Leaderboard, "board" | "primaryClubName" | "weekly">) {
  const club = lb.primaryClubName ?? undefined;
  const basis = lb.weekly ? "XP this week · resets Monday" : "lifetime XP (no XP logged this week yet)";
  return {
    title: TITLES[lb.board](club),
    rules: `${basis} · ${WHAT_COUNTS[lb.board](club)}`,
    empty: EMPTY[lb.board](club),
  };
}
