import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { homeFor } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Role-aware landing: the root page is the single destination decider so
  // the role lookup stays out of proxy.ts middleware (see plan Phase 0/5).
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  redirect(homeFor(profile?.role));
}
