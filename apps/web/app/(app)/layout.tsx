import { redirect } from "next/navigation";
import { AppShell } from "@/components/design-system/app-shell";
import { getMe } from "@/app/lib/me-data";
import { canCoach } from "@/lib/roles";

/** Signed-in area: a real session check (the proxy only looks for the cookie). */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect("/auth/login");
  return (
    <AppShell coachNav={canCoach(me.role)} communityNav={me.features.community}>
      {children}
    </AppShell>
  );
}
