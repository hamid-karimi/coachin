import type { createClient } from "@/lib/supabase/server";
import { planWeekForDate, toLocalYMD } from "@/lib/dates";
import {
  supplementTakenRate,
  type WindowDay,
} from "@/lib/supplement-adherence";
import type { SupplementScheduleType } from "@/lib/supplement-schedule";

export type TraineeSupplementRow = {
  id: string;
  name: string;
  dose: string | null;
  scheduleType: SupplementScheduleType;
  daysOfWeek: number[] | null;
  /** Due days in the last 7 days that were taken. */
  takenDueDays: number;
  /** Due days in the last 7 days (on/after the supplement's created date). */
  totalDueDays: number;
};

export type TraineeSupplementsData = {
  trainee: { id: string; name: string };
  sharingEnabled: boolean;
  supplements: TraineeSupplementRow[];
};

const WINDOW_DAYS = 7;

type ActivePlan = { id: string; created_at: string; weeks_total: number };
type PlanItemDay = { plan_id: string; week: number; day_of_week: number };
type ScheduleDay = {
  day_of_week: number;
  starts_on: string | null;
  ends_on: string | null;
};

function within(ymd: string, start: string | null, end: string | null): boolean {
  return (!start || ymd >= start) && (!end || ymd <= end);
}

/**
 * Which of the last `WINDOW_DAYS` days are training days, mirroring the
 * dashboard's rule: a date trains when an active plan session or a recurring
 * routine session falls on it. training_plans, plan_items, and schedules all
 * have coach-read RLS, so these reads succeed for an active coach. When the
 * trainee genuinely has no training structure (no active plan and no
 * schedule), every day is treated as a training day so `training_days`
 * supplements degrade to daily rather than reading as "no due days".
 */
function buildWindow(
  plans: ActivePlan[],
  planItems: PlanItemDay[],
  schedules: ScheduleDay[],
): WindowDay[] {
  const hasStructure = plans.length > 0 || schedules.length > 0;
  const window: WindowDay[] = [];
  for (let offset = WINDOW_DAYS - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const ymd = toLocalYMD(date);
    const weekday = date.getDay();

    const planTrains = plans.some((plan) => {
      const week = planWeekForDate(plan.created_at, date);
      if (week < 1 || week > plan.weeks_total) return false;
      return planItems.some(
        (item) =>
          item.plan_id === plan.id &&
          item.week === week &&
          item.day_of_week === weekday,
      );
    });
    const routineTrains = schedules.some(
      (schedule) =>
        schedule.day_of_week === weekday &&
        within(ymd, schedule.starts_on, schedule.ends_on),
    );

    window.push({
      ymd,
      weekday,
      isTrainingDay: hasStructure ? planTrains || routineTrains : true,
    });
  }
  return window;
}

/**
 * Coach view of a trainee's daily supplement stack. Returns null when the
 * trainee is not actively coached by this coach (the page redirects). The
 * supplement reads run under the coach-read RLS policies
 * (supplements_coach_read migration): with nutrition sharing off they return
 * empty and the section shows the opt-in explainer. Read-only — no mutation
 * surface is exposed and INSERT/DELETE stay self-only in RLS.
 */
export async function getTraineeSupplements(
  supabase: Awaited<ReturnType<typeof createClient>>,
  coachId: string,
  traineeId: string,
): Promise<TraineeSupplementsData | null> {
  const { data: relationship } = await supabase
    .from("coaching_relationships")
    .select("student:profiles(id, full_name, email)")
    .eq("coach_id", coachId)
    .eq("student_id", traineeId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  // Supabase types to-one joins as arrays; the row is a single object.
  const student = relationship?.student as unknown as {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
  if (!student) return null;

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - (WINDOW_DAYS - 1));
  const windowStartYmd = toLocalYMD(windowStart);

  const [
    { data: sharingRow },
    { data: supplementRows },
    { data: logRows },
    { data: planRows },
    { data: scheduleRows },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("nutrition_sharing_enabled")
      .eq("id", traineeId)
      .maybeSingle(),
    supabase
      .from("supplements")
      .select("id, name, dose, schedule_type, days_of_week, created_at")
      .eq("user_id", traineeId)
      .order("created_at"),
    supabase
      .from("supplement_logs")
      .select("supplement_id, date")
      .eq("user_id", traineeId)
      .gte("date", windowStartYmd),
    supabase
      .from("training_plans")
      .select("id, created_at, weeks_total")
      .eq("user_id", traineeId)
      .eq("status", "active"),
    supabase
      .from("schedules")
      .select("day_of_week, starts_on, ends_on")
      .eq("user_id", traineeId),
  ]);

  const plans = (planRows ?? []) as ActivePlan[];
  const schedules = (scheduleRows ?? []) as ScheduleDay[];

  // plan_items has no user_id column, so it can only be reached through the
  // plan ids. Skip the round trip entirely when no plan is readable.
  let planItems: PlanItemDay[] = [];
  if (plans.length > 0) {
    const { data: itemRows } = await supabase
      .from("plan_items")
      .select("plan_id, week, day_of_week")
      .in(
        "plan_id",
        plans.map((plan) => plan.id),
      );
    planItems = (itemRows ?? []) as PlanItemDay[];
  }

  const window = buildWindow(plans, planItems, schedules);

  // Group logs into a set of taken YMDs per supplement.
  const takenBySupplement = new Map<string, Set<string>>();
  for (const log of (logRows ?? []) as {
    supplement_id: string;
    date: string;
  }[]) {
    const set = takenBySupplement.get(log.supplement_id) ?? new Set<string>();
    set.add(log.date);
    takenBySupplement.set(log.supplement_id, set);
  }

  const supplements: TraineeSupplementRow[] = (
    (supplementRows ?? []) as {
      id: string;
      name: string;
      dose: string | null;
      schedule_type: string;
      days_of_week: number[] | null;
      created_at: string;
    }[]
  ).map((row) => {
    const scheduleType = row.schedule_type as SupplementScheduleType;
    const daysOfWeek = row.days_of_week;
    const { takenDueDays, totalDueDays } = supplementTakenRate(
      { scheduleType, daysOfWeek },
      toLocalYMD(new Date(row.created_at)),
      window,
      takenBySupplement.get(row.id) ?? new Set<string>(),
    );
    return {
      id: row.id,
      name: row.name,
      dose: row.dose,
      scheduleType,
      daysOfWeek,
      takenDueDays,
      totalDueDays,
    };
  });

  return {
    trainee: {
      id: student.id,
      name: student.full_name || student.email || "Trainee",
    },
    sharingEnabled: Boolean(sharingRow?.nutrition_sharing_enabled),
    supplements,
  };
}
