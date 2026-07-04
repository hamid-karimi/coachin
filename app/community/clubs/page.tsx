import { ClubMembershipSection } from "../components/ClubMembershipSection";
import { getClubsData } from "../lib/clubs-data";

export const dynamic = "force-dynamic";

export default async function ClubsPage() {
  const { clubMemberships } = await getClubsData();

  return <ClubMembershipSection memberships={clubMemberships} />;
}
