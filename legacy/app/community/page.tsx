import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type CommunityPageProps = {
  searchParams?: Promise<{
    tab?: string;
    board?: string;
    q?: string;
  }>;
};

/**
 * Legacy redirector: the community tabs are now route segments.
 * Old `?tab=` URLs map onto `/community/{boards|coaching|clubs|circle}`.
 */
export default async function CommunityPage({
  searchParams,
}: CommunityPageProps) {
  const resolvedSearchParams = await searchParams;
  const tab = resolvedSearchParams?.tab;

  if (tab === "coaching") {
    redirect("/community/coaching");
  }

  if (tab === "clubs") {
    redirect("/community/clubs");
  }

  if (tab === "circle") {
    const q = resolvedSearchParams?.q;
    redirect(
      q
        ? `/community/circle?q=${encodeURIComponent(q)}`
        : "/community/circle",
    );
  }

  // "leaderboards" is the legacy name for the boards tab; missing tab also
  // lands on boards.
  const board =
    resolvedSearchParams?.board === "club" ||
    resolvedSearchParams?.board === "circle"
      ? resolvedSearchParams.board
      : null;

  redirect(board ? `/community/boards?board=${board}` : "/community/boards");
}
