import Link from "next/link";
import { createClient, getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  CalendarHeart,
  CalendarRange,
  Camera,
  ChevronRight,
  Flame,
  GraduationCap,
  Heart,
  MoonStar,
  Target,
  TriangleAlert,
  UtensilsCrossed,
} from "lucide-react";

import { AppShell } from "@/components/design-system/app-shell";
import { LevelRing } from "@/components/design-system/level-ring";
import { StatCard } from "@/components/design-system/stat-card";
import { StreakBadge } from "@/components/design-system/streak-badge";
import { XpBar } from "@/components/design-system/xp-bar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { levelProgress } from "@/lib/xp";
import { canCoach } from "@/lib/roles";
import { tierFromLeague } from "@/lib/tiers";
import { getCoachingSummary } from "@/app/coaching/lib/coaching-hub-data";
import { getGoalsWithProgress } from "@/lib/goals-data";
import { settleUserStreak } from "@/lib/streak-data";
import { mondayOf, planWeekForDate, toLocalYMD } from "@/lib/dates";
import { quotaProgress } from "@/lib/weekly-quotas";
import { getWeeklyQuotas } from "@/app/onboarding/actions";
import { QuotaChip } from "@/components/design-system/quota-chip";
import { hasHardCollision } from "@/lib/training-day";
import { isCommunityEnabled } from "@/lib/feature-flags";
import { isSupplementDue } from "@/lib/supplement-schedule";
import { GOAL_TYPE_META } from "@/lib/goals";
import { Progress } from "@/components/ui/progress";
import { WorkoutCard } from "./components/workout-card";
import { TodaysMealsCard } from "./components/todays-meals-card";
import {
  SupplementsCard,
  type SupplementRow,
} from "./components/supplements-card";
import { getActiveMealPlanByDay } from "@/app/nutrition/lib/meal-plan-day";
import {
  PlanItemRow,
  type PlanItem,
} from "@/app/training/components/plan-item-row";

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
  // Settle any un-evaluated past days (streak/hearts) before reading profile.
  await settleUserStreak(supabase);
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError) {
    // Mid-logout or revoked session: the auth cookie can outlive the row
    // access. Bounce to login instead of a 500 (see logoutAction).
    console.error("Error fetching profile:", profileError);
    redirect("/auth/login");
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
    .eq("day_of_week", dayIndex)
    // Respect the recurring window: hide routines that haven't started or
    // have already ended.
    .or(`starts_on.is.null,starts_on.lte.${dateString}`)
    .or(`ends_on.is.null,ends_on.gte.${dateString}`);

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

  // Current local week window (Mon–Sun) for weekly-target progress.
  const weekMonday = mondayOf(today);
  const weekSunday = new Date(weekMonday);
  weekSunday.setDate(weekMonday.getDate() + 6);

  // Coaching card (plan Phase 5): only coach-capable roles with ≥1 trainee.
  const isCoachCapable = canCoach(profile.role);
  const [
    coachingSummary,
    goalsData,
    { data: activePlans },
    quotas,
    { data: weekLogs },
    mealPlanByDay,
    { data: supplementRows },
    { data: supplementLogRows },
    { count: scheduleCount },
    { data: latestProgressPhoto },
  ] = await Promise.all([
    isCoachCapable
      ? getCoachingSummary(supabase, user.id)
      : Promise.resolve({ traineeCount: 0, trainedThisWeek: 0 }),
    getGoalsWithProgress(supabase, user.id),
    supabase
      .from("training_plans")
      .select("id, weeks_total, created_at, race_date")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("plan_kind"),
    getWeeklyQuotas(),
    supabase
      .from("logs")
      .select("date, sport_type_id, status")
      .eq("user_id", user.id)
      .gte("date", toLocalYMD(weekMonday))
      .lte("date", toLocalYMD(weekSunday)),
    getActiveMealPlanByDay(supabase, user.id),
    supabase
      .from("supplements")
      .select("id, name, dose, schedule_type, days_of_week")
      .eq("user_id", user.id)
      .order("created_at"),
    supabase
      .from("supplement_logs")
      .select("supplement_id")
      .eq("user_id", user.id)
      .eq("date", dateString),
    // Existence only: does the user have any recurring routine at all? Used to
    // decide whether "training days" supplements should degrade to daily.
    supabase
      .from("schedules")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    // Progress-photo nudge: only the newest journal photo's date matters.
    supabase
      .from("body_photos")
      .select("created_at")
      .eq("user_id", user.id)
      .eq("kind", "progress")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Quiet progress-photo nudge (share-progress phase 2): active users whose
  // newest journal photo is ≥28 days old (or who have none). No XP, no badge.
  const PROGRESS_PHOTO_NUDGE_DAYS = 28;
  const lastProgressPhotoAt = latestProgressPhoto?.created_at
    ? new Date(latestProgressPhoto.created_at)
    : null;
  const progressPhotoDue =
    (profile.current_streak ?? 0) > 0 || (weekLogs ?? []).length > 0
      ? !lastProgressPhotoAt ||
        today.getTime() - lastProgressPhotoAt.getTime() >
          PROGRESS_PHOTO_NUDGE_DAYS * 24 * 60 * 60 * 1000
      : false;

  const takenSupplementIds = (supplementLogRows ?? []).map(
    (row) => row.supplement_id as string,
  );
  const todaysMeals = mealPlanByDay?.byDay.get(dayIndex) ?? [];

  // Weekly-target progress (informational only — FORMULAS.md §11).
  const quotaChips = quotaProgress(quotas, weekLogs ?? []);
  const quotaNameById = new Map(
    quotas.map((quota) => [quota.sport_type_id, quota.sport_types?.name]),
  );

  const plans = (activePlans ?? []) as {
    id: string;
    weeks_total: number;
    created_at: string;
    race_date: string | null;
  }[];
  const hasActivePlan = plans.length > 0;

  // AI-plan sessions scheduled for today, blended across all active plans and
  // surfaced in "Today's plan" so the plan lives in the daily flow alongside
  // the recurring routine. Each plan computes its own date-anchored week (same
  // convention as /calendar) so today's items match the calendar for this date.
  let planToday: PlanItem[] = [];
  let planWeekLabel = 0;
  const activeToday = plans
    .map((plan) => ({
      plan,
      week: planWeekForDate(plan.created_at, today),
    }))
    .filter(({ plan, week }) => week >= 1 && week <= plan.weeks_total);
  if (activeToday.length > 0) {
    planWeekLabel = activeToday[0].week;
    const { data: items } = await supabase
      .from("plan_items")
      .select(
        "id, plan_id, week, day_of_week, item_type, title, description, details, is_completed",
      )
      .in(
        "plan_id",
        activeToday.map(({ plan }) => plan.id),
      )
      .eq("day_of_week", dayIndex);
    const weekByPlan = new Map(
      activeToday.map(({ plan, week }) => [plan.id, week]),
    );
    planToday = ((items ?? []) as (PlanItem & { plan_id: string })[]).filter(
      (item) => item.week === weekByPlan.get(item.plan_id),
    );
  }
  const planCollision = hasHardCollision(planToday);

  // "Training day" for supplement due-dates: does an AI plan session or a
  // recurring routine session fall on today? When the user has NO training
  // structure at all (no active plan and no recurring routine), "training days"
  // supplements degrade to daily so they never vanish from the checklist
  // (isSupplementDue contract). A rest day within an existing plan/routine is
  // correctly not a training day.
  const trainsToday = planToday.length > 0 || (todaysPlan?.length ?? 0) > 0;
  const hasTrainingStructure = hasActivePlan || (scheduleCount ?? 0) > 0;
  const isTrainingDay = hasTrainingStructure ? trainsToday : true;
  const supplements: SupplementRow[] = (
    (supplementRows ?? []) as {
      id: string;
      name: string;
      dose: string | null;
      schedule_type: string;
      days_of_week: number[] | null;
    }[]
  ).map((row) => {
    const scheduleType = row.schedule_type as SupplementRow["scheduleType"];
    const daysOfWeek = row.days_of_week;
    return {
      id: row.id,
      name: row.name,
      dose: row.dose,
      scheduleType,
      daysOfWeek,
      due: isSupplementDue(
        { scheduleType, daysOfWeek },
        { weekday: dayIndex, isTrainingDay },
      ),
    };
  });
  // Group-streak nudge: only when the user hasn't logged anything today.
  // Skipped entirely while community is feature-flagged off (its link
  // targets /community/groups, which redirects while disabled).
  let groupAtRisk: { name: string; streak_count: number } | null = null;
  if (isCommunityEnabled() && (todaysLogs ?? []).length === 0) {
    const { data: myGroups } = await supabase
      .from("group_members")
      .select("training_groups(name, streak_count)")
      .eq("user_id", user.id);
    const candidates = (myGroups ?? [])
      .map(
        (row) =>
          row.training_groups as unknown as {
            name: string;
            streak_count: number;
          } | null,
      )
      .filter(
        (group): group is { name: string; streak_count: number } =>
          Boolean(group) && Number(group?.streak_count) > 0,
      )
      .sort((a, b) => b.streak_count - a.streak_count);
    groupAtRisk = candidates[0] ?? null;
  }

  // Compact strip shows the tracked goal closest to completion.
  const featuredGoal = goalsData.active
    .filter((goal) => goal.progress !== null)
    .sort((a, b) => (b.progress?.pct ?? 0) - (a.progress?.pct ?? 0))[0];

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

  // Meal notes carry no "done" toggle, so they stay out of the day's tally.
  const checkablePlanItems = planToday.filter(
    (item) => item.item_type !== "meal_note",
  );
  const doneCount =
    (todaysPlan ?? []).filter((item: ScheduleItem) =>
      isCompleted(item.sport_type_id),
    ).length + checkablePlanItems.filter((item) => item.is_completed).length;
  const totalCount = (todaysPlan?.length ?? 0) + checkablePlanItems.length;

  const dateLabel = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <AppShell coachNav={canCoach(profile.role)}>
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

        {/* Coaching card — coach-capable roles with at least one trainee */}
        {coachingSummary.traineeCount > 0 && (
          <Link
            href="/coaching"
            className="bg-card border-border hover:border-brand/40 group flex items-center gap-3.5 rounded-2xl border p-4 transition-colors"
          >
            <span className="bg-brand-tint text-brand-ink grid size-10 shrink-0 place-items-center rounded-xl">
              <GraduationCap className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-foreground block text-sm font-semibold">
                Coaching
              </span>
              <span className="text-muted-foreground block text-[13px]">
                {coachingSummary.traineeCount}{" "}
                {coachingSummary.traineeCount === 1 ? "trainee" : "trainees"} ·{" "}
                {coachingSummary.trainedThisWeek} trained this week
              </span>
            </span>
            <ChevronRight
              className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-colors"
              aria-hidden
            />
          </Link>
        )}

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

        {/* Marathon discovery — no plan yet, point at the generator */}
        {!hasActivePlan && (
          <Link
            href="/training"
            className="bg-card border-border hover:border-brand/40 group flex items-center gap-3.5 rounded-2xl border p-4 transition-colors"
          >
            <span className="bg-brand-tint text-brand-ink grid size-10 shrink-0 place-items-center rounded-xl">
              <CalendarHeart className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-foreground block text-sm font-semibold">
                Train for a marathon
              </span>
              <span className="text-muted-foreground block text-[13px]">
                Get an AI week-by-week program built around your running
              </span>
            </span>
            <ChevronRight
              className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-colors"
              aria-hidden
            />
          </Link>
        )}

        {/* Training plan card (roadmap branch 4) — blends all active plans */}
        {hasActivePlan && (
          <div className="flex flex-col gap-2">
            <Link
              href="/training"
              className="bg-card border-border hover:border-brand/40 group flex items-center gap-3.5 rounded-2xl border p-4 transition-colors"
            >
              <span className="bg-brand-tint text-brand-ink grid size-10 shrink-0 place-items-center rounded-xl">
                <CalendarHeart className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-foreground block text-sm font-semibold">
                  {plans.length > 1 ? "Training plans" : "Training plan"}
                </span>
                <span className="text-muted-foreground block text-[13px]">
                  {plans.length > 1 ? `${plans.length} active · ` : ""}
                  {planToday.length > 0
                    ? `${planToday.length} ${planToday.length === 1 ? "item" : "items"} today`
                    : "rest day"}
                </span>
              </span>
              <ChevronRight
                className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-colors"
                aria-hidden
              />
            </Link>
          </div>
        )}

        {/* Weekly targets — quiet quota progress for the current week */}
        {quotaChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-0.5">
            <span className="text-muted-foreground text-xs font-medium">
              This week
            </span>
            {quotaChips.map((chip) => (
              <QuotaChip
                key={chip.sport_type_id}
                name={quotaNameById.get(chip.sport_type_id) ?? "Sport"}
                done={chip.done}
                target={chip.target}
              />
            ))}
          </div>
        )}

        {/* Group-streak nudge (roadmap branch 6) */}
        {groupAtRisk && (
          <Link
            href="/community/groups"
            className="bg-flame-tint border-flame/30 flex items-center gap-3.5 rounded-2xl border p-4"
          >
            <span className="text-flame-ink grid size-10 shrink-0 place-items-center">
              <Flame className="size-6" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-flame-ink block text-sm font-bold">
                {groupAtRisk.name}&apos;s {groupAtRisk.streak_count}-day streak
                needs you
              </span>
              <span className="text-flame-ink/80 block text-[13px]">
                Log a workout today so nobody&apos;s streak freezes.
              </span>
            </span>
            <ChevronRight
              className="text-flame-ink size-4 shrink-0"
              aria-hidden
            />
          </Link>
        )}

        {/* Weekly calendar entry */}
        <Link
          href="/calendar"
          className="bg-card border-border hover:border-brand/40 group flex items-center gap-3.5 rounded-2xl border p-4 transition-colors"
        >
          <span className="bg-brand-tint text-brand-ink grid size-10 shrink-0 place-items-center rounded-xl">
            <CalendarRange className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-foreground block text-sm font-semibold">
              This week
            </span>
            <span className="text-muted-foreground block text-[13px]">
              Routine, plan, and logged workouts on real dates
            </span>
          </span>
          <ChevronRight
            className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-colors"
            aria-hidden
          />
        </Link>

        {/* Nutrition entry (roadmap branch 5) */}
        <Link
          href="/nutrition"
          className="bg-card border-border hover:border-brand/40 group flex items-center gap-3.5 rounded-2xl border p-4 transition-colors"
        >
          <span className="bg-flame-tint text-flame-ink grid size-10 shrink-0 place-items-center rounded-xl">
            <UtensilsCrossed className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-foreground block text-sm font-semibold">
              Nutrition
            </span>
            <span className="text-muted-foreground block text-[13px]">
              Log meals by search or photo · +5 XP each (first 3 daily)
            </span>
          </span>
          <ChevronRight
            className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-colors"
            aria-hidden
          />
        </Link>

        {/* Quiet progress-photo nudge — link only, dismissed by doing it */}
        {progressPhotoDue && (
          <Link
            href="/profile"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 px-0.5 text-xs transition-colors"
          >
            <Camera className="size-3.5" aria-hidden />
            {lastProgressPhotoAt
              ? "It's been a few weeks — add a progress photo"
              : "Start your progress-photo journal on your profile"}
          </Link>
        )}

        {/* Today's menu from the active AI meal plan */}
        {mealPlanByDay && (
          <TodaysMealsCard
            meals={todaysMeals}
            kcalTarget={mealPlanByDay.kcalTarget}
          />
        )}

        {/* Daily supplements — reminder + logger, no XP (FORMULAS.md §13) */}
        <SupplementsCard
          supplements={supplements}
          takenIds={takenSupplementIds}
        />

        {/* Active goal strip (roadmap branch 2) */}
        {featuredGoal && featuredGoal.progress && (
          <Link
            href="/profile"
            className="bg-card border-border hover:border-brand/40 block space-y-2 rounded-2xl border p-4 transition-colors"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-foreground inline-flex items-center gap-2 text-sm font-semibold">
                <Target className="text-brand size-4" aria-hidden />
                {GOAL_TYPE_META[featuredGoal.goal_type].label} goal
              </span>
              <span className="text-muted-foreground text-[13px]">
                {featuredGoal.current}
                {GOAL_TYPE_META[featuredGoal.goal_type].unit} →{" "}
                {featuredGoal.target_value}
                {GOAL_TYPE_META[featuredGoal.goal_type].unit}
              </span>
            </div>
            <Progress value={featuredGoal.progress.pct} />
          </Link>
        )}

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

          {(!todaysPlan || todaysPlan.length === 0) &&
          planToday.length === 0 ? (
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
              {(todaysPlan ?? []).map((item: ScheduleItem) => {
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
              {planToday.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-overline flex items-center justify-between">
                    <span>From your plan</span>
                    <Link
                      href="/training"
                      className="text-brand-ink text-[11px] font-medium normal-case hover:underline"
                    >
                      Week {planWeekLabel} →
                    </Link>
                  </p>
                  {planCollision && (
                    <p className="bg-flame-tint text-flame-ink inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium">
                      <TriangleAlert className="size-3.5" aria-hidden />2
                      intense workouts today — consider spacing them.
                    </p>
                  )}
                  {planToday.map((item) => (
                    <PlanItemRow key={item.id} item={item} date={dateString} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
