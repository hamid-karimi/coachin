import Link from "next/link";
import { createClient, getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Heart, MoonStar } from "lucide-react";

import { AppShell } from "@/components/design-system/app-shell";
import { LevelRing } from "@/components/design-system/level-ring";
import { StatCard } from "@/components/design-system/stat-card";
import { StreakBadge } from "@/components/design-system/streak-badge";
import { XpBar } from "@/components/design-system/xp-bar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { levelProgress } from "@/lib/xp";
import { tierFromLeague } from "@/lib/tiers";
import { WorkoutCard } from "./components/workout-card";

export const dynamic = "force-dynamic";

const TIER_LABELS: Record<string, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
};

type SportTypeSummary = {
  id?: number | null;
  name?: string | null;
  xp_multiplier?: number | null;
};

export type ScheduleItem = {
  id: number;
  sport_type_id: number;
  time?: string | null;
  sport_types?: SportTypeSummary | null;
};

export default async function Dashboard() {
  const user = await getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Error fetching profile:", profileError);
    throw new Error("Failed to load profile");
  }

  const today = new Date();
  const dayIndex = today.getDay();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const dateString = `${year}-${month}-${day}`;

  const { data: todaysPlan, error: todaysPlanError } = await supabase
    .from("schedules")
    .select("*, sport_types(name, xp_multiplier, id)")
    .eq("user_id", user.id)
    .eq("day_of_week", dayIndex);

  if (todaysPlanError) {
    console.error("Error fetching today's plan:", todaysPlanError);
    throw new Error("Failed to load today's plan");
  }

  const { data: todaysLogs, error: todaysLogsError } = await supabase
    .from("logs")
    .select("sport_type_id")
    .eq("user_id", user.id)
    .eq("date", dateString);

  if (todaysLogsError) {
    console.error("Error fetching today's logs:", todaysLogsError);
    throw new Error("Failed to load today's logs");
  }

  // Note: This completion check uses sport_type_id only. If a user has multiple
  // schedule items for the same sport type in one day, completing one will mark
  // all as completed. To fix this, the logs table should include a schedule_id
  // field to track completion per schedule item.
  const isCompleted = (sportId: number) => {
    return todaysLogs?.some((log) => log.sport_type_id === sportId);
  };

  const name: string = user.user_metadata.full_name || user.email || "athlete";
  const firstName = name.split(" ")[0];
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

  const doneCount = (todaysPlan ?? []).filter((item: ScheduleItem) =>
    isCompleted(item.sport_type_id),
  ).length;
  const totalCount = todaysPlan?.length ?? 0;

  const dateLabel = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-[13px]">{dateLabel}</p>
            <h1 className="text-foreground font-display text-2xl font-bold tracking-tight md:text-[28px]">
              Hi, {firstName}
            </h1>
          </div>
          <div className="flex items-center gap-2.5">
            <StreakBadge days={streak} compact />
            <Link href="/profile" aria-label="Open profile">
              <Avatar className="size-10">
                <AvatarFallback className="font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </div>

        {/* Level card */}
        <div className="bg-card border-border flex items-center gap-4 rounded-2xl border p-4 md:p-5">
          <LevelRing level={level} progress={progressPct} size="lg" />
          <div className="min-w-0 flex-1">
            <XpBar
              level={level}
              currentXp={progress.currentXp}
              nextLevelXp={progress.nextLevelXp}
              totalXp={xp}
            />
          </div>
        </div>

        {/* Hearts strip */}
        <div className="flex items-center gap-1.5 px-0.5">
          {[0, 1, 2].map((index) => (
            <Heart
              key={index}
              className={cn(
                "size-4",
                index < hearts
                  ? "fill-destructive text-destructive"
                  : "text-muted-foreground/40",
              )}
              aria-hidden
            />
          ))}
          <span className="text-muted-foreground ml-1 text-xs">
            {hearts} {hearts === 1 ? "heart" : "hearts"} · a missed day costs
            one
          </span>
        </div>

        {/* Desktop stat row */}
        <div className="hidden gap-3 sm:grid sm:grid-cols-4">
          <StatCard label="Level" value={level} accent="brand" />
          <StatCard
            label="Streak"
            value={
              <>
                {streak}
                <span className="text-flame text-base">🔥</span>
              </>
            }
          />
          <StatCard label="Total XP" value={xp.toLocaleString()} />
          <StatCard
            label="League"
            value={TIER_LABELS[tier]}
            accent="gold"
          />
        </div>

        {/* Today's plan */}
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-foreground text-[17px] font-bold">
              Today&apos;s plan
            </h2>
            {totalCount > 0 && (
              <span className="text-muted-foreground text-[13px]">
                {doneCount} of {totalCount} done
              </span>
            )}
          </div>

          {!todaysPlan || todaysPlan.length === 0 ? (
            <div className="border-border flex flex-col items-center gap-2.5 rounded-xl border border-dashed px-5 py-8 text-center">
              <span className="bg-secondary text-muted-foreground grid size-12 place-items-center rounded-full">
                <MoonStar className="size-5" aria-hidden />
              </span>
              <p className="text-foreground font-semibold">Rest day</p>
              <p className="text-muted-foreground max-w-70 text-sm leading-relaxed">
                Nothing scheduled — recovery counts. Your streak is safe on
                rest days.
              </p>
              <Button asChild variant="secondary" size="sm" className="mt-1">
                <Link href="/onboarding">Edit plan</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {todaysPlan.map((item: ScheduleItem) => {
                const completed = isCompleted(item.sport_type_id);

                return (
                  <WorkoutCard
                    key={item.id}
                    item={item}
                    completed={completed}
                    streak={streak}
                    bestStreak={bestStreak}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
