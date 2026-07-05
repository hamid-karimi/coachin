import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { canCoach } from "@/lib/roles";
import { yearsSince } from "@/lib/dates";
import { AppShell } from "@/components/design-system/app-shell";
import { IntakeWizard } from "../components/intake-wizard";

export const dynamic = "force-dynamic";

export default async function NewMarathonPlanPage() {
  const user = await getUser();
  if (!user) {
    redirect("/auth/login");
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, birth_date, sex, height_cm, weight_kg, training_history")
    .eq("id", user.id)
    .single();

  const age = yearsSince(profile?.birth_date);

  const parts = [
    age ? `${age} years old` : null,
    profile?.sex ?? null,
    profile?.height_cm ? `${profile.height_cm}cm` : null,
    profile?.weight_kg ? `${profile.weight_kg}kg` : null,
  ].filter(Boolean);
  const hasBodyProfile = parts.length >= 3;
  const profileSummary =
    parts.length > 0
      ? `${parts.join(" · ")}${profile?.training_history ? ` — ${profile.training_history}` : ""}`
      : "No body profile yet — the plan will rely on your running answers only.";

  return (
    <AppShell coachNav={canCoach(profile?.role)}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <div>
          <h1 className="text-foreground font-display text-2xl font-bold tracking-tight md:text-[28px]">
            Marathon plan
          </h1>
          <p className="text-muted-foreground text-sm">
            Answer a few questions and get a week-by-week program: running,
            strength, mobility, recovery, and fueling notes.
          </p>
        </div>
        <IntakeWizard
          profileSummary={profileSummary}
          hasBodyProfile={hasBodyProfile}
        />
      </div>
    </AppShell>
  );
}
