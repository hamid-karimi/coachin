import { createClient, getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarHeart, ChevronRight, Flame, Heart, Pencil } from "lucide-react";

import { AppShell } from "@/components/design-system/app-shell";
import { StatCard } from "@/components/design-system/stat-card";
import { TierBadge } from "@/components/design-system/tier-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { levelProgress } from "@/lib/xp";
import { canCoach } from "@/lib/roles";
import { tierFromLeague } from "@/lib/tiers";
import { LogoutButton } from "./components/logout-button";
import { ThemePreference } from "./components/theme-preference";
import { NutritionSharingToggle } from "./components/nutrition-sharing-toggle";
import { BodyMetricsForm } from "./components/body-metrics-form";
import { ActivityImportSection } from "./components/activity-import-section";
import {
  MeasurementsSection,
  type Measurement,
} from "./components/measurements-section";
import { GoalsSection } from "./components/goals-section";
import { getGoalsWithProgress } from "@/lib/goals-data";
import { settleUserStreak } from "@/lib/streak-data";
import {
  BodyPhotosSection,
  type BodyPhotoItem,
} from "./components/body-photos-section";
import type { BodyAnalysis } from "@/lib/ai/gemini";

export const dynamic = "force-dynamic";

type XpTransaction = {
  id: number;
  amount: number;
  reason: string | null;
  created_at: string;
};

function formatReason(
  reason: string | null,
  sportNames: Map<number, string>,
): string {
  if (!reason) return "XP earned";
  const workoutMatch = reason.match(/^workout_log:(\d+)$/);
  if (workoutMatch) {
    const sportName = sportNames.get(Number(workoutMatch[1]));
    return sportName ? `${sportName} workout` : "Workout logged";
  }
  if (reason.includes("streak")) return "Streak bonus";
  return reason.replaceAll("_", " ");
}

export default async function ProfilePage() {
  const user = await getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const supabase = await createClient();
  // Settle any un-evaluated past days (streak/hearts) before reading profile.
  await settleUserStreak(supabase);

  const [
    { data: profile, error: profileError },
    { data: transactions },
    { data: sportTypes },
    { count: workoutCount },
    { data: measurements },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("xp_transactions")
      .select("id, amount, reason, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("sport_types").select("id, name"),
    supabase
      .from("logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "completed"),
    supabase
      .from("body_measurements")
      .select("id, measured_at, weight_kg, body_fat_pct")
      .eq("user_id", user.id)
      .order("measured_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  if (profileError || !profile) {
    console.error("Error fetching profile:", profileError);
    throw new Error("Failed to load profile");
  }

  const goalsData = await getGoalsWithProgress(supabase, user.id);

  // Body photos: metadata + short-lived signed URLs (bucket is private).
  const { data: photoRows } = await supabase
    .from("body_photos")
    .select("id, kind, storage_path, analysis, analyzed_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const bodyPhotos: BodyPhotoItem[] = await Promise.all(
    (photoRows ?? []).map(async (row) => {
      const { data: signed } = await supabase.storage
        .from("body-photos")
        .createSignedUrl(row.storage_path, 3600);
      return {
        id: row.id as string,
        kind: row.kind as BodyPhotoItem["kind"],
        url: signed?.signedUrl ?? null,
        created_at: row.created_at as string,
      };
    }),
  );

  const latestAnalysis =
    ((photoRows ?? []).find(
      (row) => row.kind === "body_photo" && row.analysis,
    )?.analysis as BodyAnalysis | undefined) ?? null;

  const sportNames = new Map<number, string>(
    (sportTypes ?? []).map((sport: { id: number; name: string }) => [
      sport.id,
      sport.name,
    ]),
  );

  const name: string =
    profile.full_name || user.user_metadata.full_name || user.email || "You";
  const initials = name
    .split(" ")
    .map((part: string) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const xp = profile.xp ?? 0;
  const level = profile.level ?? 1;
  const streak = profile.current_streak ?? 0;
  const bestStreak = profile.best_streak ?? 0;
  const hearts = Math.max(0, Math.min(3, profile.hearts ?? 3));
  const tier = tierFromLeague(profile.league_tier);
  const progress = levelProgress(xp);
  const progressPct = Math.round(
    (progress.currentXp / progress.nextLevelXp) * 100,
  );

  const joined = user.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <AppShell coachNav={canCoach(profile.role)}>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        {/* Identity */}
        <div className="flex items-center gap-4 md:gap-5">
          <div
            className="grid size-19 shrink-0 place-items-center rounded-full md:size-22"
            style={{
              background: `conic-gradient(var(--brand) 0 ${progressPct}%, var(--border) ${progressPct}% 100%)`,
            }}
            aria-label={`Level ${level}, ${progressPct}% to next level`}
          >
            <Avatar className="border-background size-16 border-3 md:size-19">
              {profile.avatar_url ? (
                <AvatarImage src={profile.avatar_url} alt={name} />
              ) : null}
              <AvatarFallback className="text-lg font-bold md:text-xl">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-foreground font-display truncate text-[22px] font-bold tracking-tight md:text-[28px]">
              {name}
            </h1>
            <p className="text-muted-foreground truncate text-sm">
              {user.email}
              {joined ? ` · joined ${joined}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="bg-xp-tint text-brand-ink rounded-full px-2.5 py-1 text-[11px] font-bold tracking-[0.05em] uppercase">
                Level {level}
              </span>
              <TierBadge tier={tier} />
              {streak > 0 && (
                <span className="bg-flame-tint text-flame-ink inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-[0.05em] uppercase">
                  <Flame className="size-3" aria-hidden />
                  {streak} days
                </span>
              )}
            </div>
          </div>
          <div className="hidden shrink-0 md:block">
            <LogoutButton />
          </div>
        </div>

        {/* Stat grid */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Total XP" value={xp.toLocaleString()} />
          <StatCard
            label="Streak"
            value={
              <>
                {streak}
                <Flame
                  className="text-flame fill-flame/30 size-4.5"
                  aria-hidden
                />
              </>
            }
          />
          <StatCard label="Best streak" value={bestStreak} />
          <StatCard label="Workouts" value={workoutCount ?? 0} />
        </div>

        {/* Hearts */}
        <div className="bg-card border-border flex items-center gap-3 rounded-xl border p-4">
          <div className="flex gap-1">
            {[0, 1, 2].map((index) => (
              <Heart
                key={index}
                className={cn(
                  "size-5",
                  index < hearts
                    ? "fill-destructive text-destructive"
                    : "text-muted-foreground/40",
                )}
                aria-hidden
              />
            ))}
          </div>
          <p className="text-muted-foreground text-[13px]">
            <span className="text-foreground font-semibold">
              {hearts} of 3 hearts.
            </span>{" "}
            A missed training day costs one — at 0, your streak resets.
          </p>
        </div>

        {/* Goals (roadmap branch 2) */}
        <section className="space-y-2.5">
          <h2 className="text-overline">Goals</h2>
          <GoalsSection active={goalsData.active} achieved={goalsData.achieved} />
        </section>

        {/* Training programs + recurring routine entry points */}
        <section className="space-y-2.5">
          <h2 className="text-overline">Training</h2>
          <div className="bg-card border-border divide-border divide-y rounded-xl border px-4">
            <Link
              href="/training"
              className="hover:bg-secondary/50 -mx-4 flex items-center gap-3 px-4 py-3"
            >
              <span className="bg-brand-tint text-brand-ink grid size-9 shrink-0 place-items-center rounded-lg">
                <CalendarHeart className="size-4.5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-foreground block text-sm font-semibold">
                  My programs
                </span>
                <span className="text-muted-foreground block text-xs">
                  View, add, or archive your training programs
                </span>
              </span>
              <ChevronRight
                className="text-muted-foreground size-4 shrink-0"
                aria-hidden
              />
            </Link>
            <Link
              href="/onboarding"
              className="hover:bg-secondary/50 -mx-4 flex items-center gap-3 px-4 py-3"
            >
              <span className="bg-brand-tint text-brand-ink grid size-9 shrink-0 place-items-center rounded-lg">
                <Pencil className="size-4.5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-foreground block text-sm font-semibold">
                  Recurring routine
                </span>
                <span className="text-muted-foreground block text-xs">
                  Edit your weekly training schedule
                </span>
              </span>
              <ChevronRight
                className="text-muted-foreground size-4 shrink-0"
                aria-hidden
              />
            </Link>
          </div>
        </section>

        {/* Body profile — feeds the AI program/diet intake (roadmap branch 1) */}
        <section className="space-y-2.5">
          <h2 className="text-overline">Body profile</h2>
          <BodyMetricsForm
            birthDate={profile.birth_date ?? null}
            sex={profile.sex ?? null}
            heightCm={profile.height_cm ?? null}
            trainingHistory={profile.training_history ?? null}
            country={profile.country ?? null}
          />
        </section>

        {/* Occasional watch-data import (FORMULAS.md §14) */}
        <section className="space-y-2.5">
          <h2 className="text-overline">Watch data</h2>
          <ActivityImportSection />
        </section>

        {/* Measurements */}
        <section className="space-y-2.5">
          <h2 className="text-overline">Measurements</h2>
          <MeasurementsSection
            measurements={(measurements ?? []) as Measurement[]}
          />
        </section>

        {/* Body photos (roadmap branch 3) */}
        <section className="space-y-2.5">
          <h2 className="text-overline">Body photos</h2>
          <BodyPhotosSection
            photos={bodyPhotos}
            consented={Boolean(profile.ai_photo_consent_at)}
            analysis={latestAnalysis}
          />
        </section>

        {/* Recent XP */}
        <section className="space-y-2.5">
          <h2 className="text-overline">Recent XP</h2>
          {!transactions || transactions.length === 0 ? (
            <div className="border-border rounded-xl border border-dashed p-5 text-center">
              <p className="text-muted-foreground text-sm">
                No XP yet — log your first workout and it shows up here.
              </p>
            </div>
          ) : (
            <div className="bg-card border-border divide-border divide-y rounded-xl border px-4">
              {transactions.map((transaction: XpTransaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-foreground truncate text-sm font-medium">
                      {formatReason(transaction.reason, sportNames)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {new Date(transaction.created_at).toLocaleDateString(
                        "en-US",
                        { weekday: "short", month: "short", day: "numeric" },
                      )}
                    </p>
                  </div>
                  <span className="text-brand-ink shrink-0 text-stat text-sm">
                    +{transaction.amount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Settings */}
        <section className="space-y-2.5">
          <h2 className="text-overline">Settings</h2>
          <div className="bg-card border-border divide-border divide-y rounded-xl border px-4">
            <div className="flex items-center justify-between gap-3 py-3">
              <span className="text-foreground text-sm font-semibold">
                Theme
              </span>
              <ThemePreference />
            </div>
            <div className="py-3">
              <NutritionSharingToggle
                enabled={Boolean(profile?.nutrition_sharing_enabled)}
              />
            </div>
            <div className="flex items-center justify-between gap-3 py-3 md:hidden">
              <span className="text-foreground text-sm font-semibold">
                Account
              </span>
              <LogoutButton />
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
