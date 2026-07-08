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
  searchParams: Promise<{ kind?: string; student?: string }>;
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

  const { kind, student } = await searchParams;
  const coachNav = canCoach(profile?.role);

  // Coach mode: ?student=<id> generates for a trainee. Verified here for the
  // page render; the action + RPC re-verify on submit.
  const studentId = (student ?? "").trim();
  let trainee: { id: string; name: string } | null = null;
  if (studentId && studentId !== user.id) {
    if (!coachNav) redirect("/training/new");
    const { data: relationship } = await supabase
      .from("coaching_relationships")
      .select("student:profiles(id, full_name, email)")
      .eq("coach_id", user.id)
      .eq("student_id", studentId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    // Supabase types to-one joins as arrays; the row is a single object.
    const traineeProfile = relationship?.student as unknown as {
      id: string;
      full_name: string | null;
      email: string | null;
    } | null;
    if (!traineeProfile) redirect("/coaching");
    trainee = {
      id: traineeProfile.id,
      name: traineeProfile.full_name || traineeProfile.email || "your trainee",
    };
  }

  // The body profile shaping the plan is the target athlete's.
  const { data: targetProfile } = trainee
    ? await supabase
        .from("profiles")
        .select("birth_date, sex, height_cm, weight_kg, training_history")
        .eq("id", trainee.id)
        .single()
    : { data: profile };

  const age = yearsSince(targetProfile?.birth_date);

  const parts = [
    age ? `${age} years old` : null,
    targetProfile?.sex ?? null,
    targetProfile?.height_cm ? `${targetProfile.height_cm}cm` : null,
    targetProfile?.weight_kg ? `${targetProfile.weight_kg}kg` : null,
  ].filter(Boolean);
  const hasBodyProfile = parts.length >= 3;
  const profileSummary =
    parts.length > 0
      ? `${parts.join(" · ")}${targetProfile?.training_history ? ` — ${targetProfile.training_history}` : ""}`
      : "No body profile yet — the plan will rely on your answers only.";

  if (kind === "race" || kind === "hypertrophy") {
    return (
      <AppShell coachNav={coachNav}>
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
          <div>
            <h1 className="text-foreground font-display text-2xl font-bold tracking-tight md:text-[28px]">
              {kind === "race" ? "Running plan" : "Muscle building plan"}
              {trainee ? ` for ${trainee.name}` : ""}
            </h1>
            {trainee && (
              <p className="text-brand-ink text-sm font-medium">
                Coach mode — this plan is generated for {trainee.name} and
                replaces their active plan right away.
              </p>
            )}
            <p className="text-muted-foreground text-sm">
              {kind === "race"
                ? "Just want to build a running habit, or training for a 5k, marathon, or ultra — answer a few questions and get a week-by-week program: running, strength, mobility, recovery, and fueling notes."
                : "A progressive-overload program built around your equipment, experience, and body profile — with form videos and protein guidance."}
            </p>
          </div>
          {kind === "race" ? (
            <IntakeWizard
              profileSummary={profileSummary}
              hasBodyProfile={hasBodyProfile}
              targetStudentId={trainee?.id}
            />
          ) : (
            <HypertrophyWizard
              profileSummary={profileSummary}
              hasBodyProfile={hasBodyProfile}
              targetStudentId={trainee?.id}
            />
          )}
        </div>
      </AppShell>
    );
  }

  const studentQuery = trainee ? `&student=${trainee.id}` : "";

  // Entry choice: what are you training for?
  return (
    <AppShell coachNav={coachNav}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <div>
          <h1 className="text-foreground font-display text-2xl font-bold tracking-tight md:text-[28px]">
            {trainee
              ? `What is ${trainee.name} training for?`
              : "What are you training for?"}
          </h1>
          <p className="text-muted-foreground text-sm">
            Both paths generate a week-by-week plan with check-ins that adapt
            it as you go. Generating replaces any existing active plan.
          </p>
        </div>

        <Link
          href={`/training/new?kind=race${studentQuery}`}
          className="bg-card border-border hover:border-brand/40 group flex items-center gap-4 rounded-2xl border p-5 transition-colors"
        >
          <span className="bg-brand-tint text-brand-ink grid size-12 shrink-0 place-items-center rounded-xl">
            <Medal className="size-6" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-foreground block text-base font-bold">
              Running
            </span>
            <span className="text-muted-foreground block text-sm">
              Start from zero to build a habit, or train for a race — 5k to
              ultra — with paces, long-run progression, and taper.
            </span>
          </span>
          <ChevronRight
            className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-colors"
            aria-hidden
          />
        </Link>

        <Link
          href={`/training/new?kind=hypertrophy${studentQuery}`}
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
