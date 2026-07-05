import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Dumbbell, Medal } from "lucide-react";

import { createClient, getUser } from "@/lib/supabase/server";
import { canCoach } from "@/lib/roles";
import { yearsSince } from "@/lib/dates";
import { AppShell } from "@/components/design-system/app-shell";
import { IntakeWizard } from "../components/intake-wizard";
import { HypertrophyWizard } from "../components/hypertrophy-wizard";

export const dynamic = "force-dynamic";

export default async function NewTrainingPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
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
      : "No body profile yet — the plan will rely on your answers only.";

  const { kind } = await searchParams;
  const coachNav = canCoach(profile?.role);

  if (kind === "race" || kind === "hypertrophy") {
    return (
      <AppShell coachNav={coachNav}>
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
          <div>
            <h1 className="text-foreground font-display text-2xl font-bold tracking-tight md:text-[28px]">
              {kind === "race" ? "Race plan" : "Muscle building plan"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {kind === "race"
                ? "From your first 5k to a full marathon and beyond — answer a few questions and get a week-by-week program: running, strength, mobility, recovery, and fueling notes."
                : "A progressive-overload program built around your equipment, experience, and body profile — with form videos and protein guidance."}
            </p>
          </div>
          {kind === "race" ? (
            <IntakeWizard
              profileSummary={profileSummary}
              hasBodyProfile={hasBodyProfile}
            />
          ) : (
            <HypertrophyWizard
              profileSummary={profileSummary}
              hasBodyProfile={hasBodyProfile}
            />
          )}
        </div>
      </AppShell>
    );
  }

  // Entry choice: what are you training for?
  return (
    <AppShell coachNav={coachNav}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <div>
          <h1 className="text-foreground font-display text-2xl font-bold tracking-tight md:text-[28px]">
            What are you training for?
          </h1>
          <p className="text-muted-foreground text-sm">
            Both paths generate a week-by-week plan with check-ins that adapt
            it as you go. Generating replaces any existing active plan.
          </p>
        </div>

        <Link
          href="/marathon/new?kind=race"
          className="bg-card border-border hover:border-brand/40 group flex items-center gap-4 rounded-2xl border p-5 transition-colors"
        >
          <span className="bg-brand-tint text-brand-ink grid size-12 shrink-0 place-items-center rounded-xl">
            <Medal className="size-6" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-foreground block text-base font-bold">
              A race
            </span>
            <span className="text-muted-foreground block text-sm">
              5k, 10k, half, marathon, or ultra — runs with paces, long-run
              progression, and taper.
            </span>
          </span>
          <ChevronRight
            className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-colors"
            aria-hidden
          />
        </Link>

        <Link
          href="/marathon/new?kind=hypertrophy"
          className="bg-card border-border hover:border-brand/40 group flex items-center gap-4 rounded-2xl border p-5 transition-colors"
        >
          <span className="bg-xp-tint text-xp-ink grid size-12 shrink-0 place-items-center rounded-xl">
            <Dumbbell className="size-6" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-foreground block text-base font-bold">
              Build muscle
            </span>
            <span className="text-muted-foreground block text-sm">
              Hypertrophy or recomposition — a progressive strength split for
              your equipment, plus mobility and protein guidance.
            </span>
          </span>
          <ChevronRight
            className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-colors"
            aria-hidden
          />
        </Link>
      </div>
    </AppShell>
  );
}
