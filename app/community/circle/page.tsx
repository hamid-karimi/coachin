import { FriendsSection } from "../components/FriendsSection";
import { getCircleData } from "../lib/circle-data";

export const dynamic = "force-dynamic";

type CirclePageProps = {
  searchParams?: Promise<{
    q?: string;
    page?: string;
  }>;
};

export default async function CirclePage({ searchParams }: CirclePageProps) {
  const resolvedSearchParams = await searchParams;

  const { followingUserIds, followingProfiles, discoverProfiles } =
    await getCircleData(
      resolvedSearchParams?.q,
      Number(resolvedSearchParams?.page ?? "1"),
    );

  return (
    <FriendsSection
      followingProfiles={followingProfiles}
      discoverProfiles={discoverProfiles}
      followingUserIds={followingUserIds}
      searchTerm={resolvedSearchParams?.q ?? ""}
    />
  );
}
