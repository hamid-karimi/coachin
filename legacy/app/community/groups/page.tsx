import { GroupsSection } from "../components/GroupsSection";
import { getGroupsData } from "../lib/groups-data";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const { groups } = await getGroupsData();

  return <GroupsSection groups={groups} />;
}
