import { createClient, getUser } from "@/lib/supabase/server";
import { planItemDate } from "@/lib/dates";
import type { PlanItemDetails } from "@/lib/plan-items";

export const dynamic = "force-dynamic";

/** RFC 5545 text escaping for SUMMARY/DESCRIPTION values. */
function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function ymdCompact(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

type PlanItemRow = {
  id: string;
  plan_id: string;
  week: number;
  day_of_week: number;
  item_type: string;
  title: string;
  description: string | null;
  details: PlanItemDetails | null;
};

/**
 * Downloadable .ics of the user's active training plan — all-day events, one
 * per plan item, importable into Apple/Google/Outlook calendars.
 */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = await createClient();
  const { data: plans } = await supabase
    .from("training_plans")
    .select("id, created_at, intake")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("plan_kind");

  const activePlans = (plans ?? []) as { id: string; created_at: string }[];
  if (activePlans.length === 0) {
    return new Response("No active plan", { status: 404 });
  }

  const createdAtByPlan = new Map(
    activePlans.map((plan) => [plan.id, plan.created_at]),
  );
  const { data: items } = await supabase
    .from("plan_items")
    .select("id, plan_id, week, day_of_week, item_type, title, description, details")
    .in(
      "plan_id",
      activePlans.map((plan) => plan.id),
    )
    .order("week")
    .order("day_of_week");

  const stamp = `${ymdCompact(new Date())}T000000Z`;
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CoachIn//Training Plan//EN",
    "CALSCALE:GREGORIAN",
  ];

  for (const item of (items ?? []) as PlanItemRow[]) {
    if (item.item_type === "meal_note") continue; // notes aren't calendar events
    const createdAt = createdAtByPlan.get(item.plan_id);
    if (!createdAt) continue;
    const date = planItemDate(createdAt, item.week, item.day_of_week);
    const start = ymdCompact(date);
    const nextDay = new Date(date);
    nextDay.setDate(date.getDate() + 1);

    const descParts = [
      [
        item.details?.distance_km ? `${item.details.distance_km}km` : null,
        item.details?.pace_min_km ? `@ ${item.details.pace_min_km}/km` : null,
        item.details?.duration_min ? `${item.details.duration_min}min` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      item.description ?? "",
      item.details?.notes ?? "",
      item.details?.video_query
        ? `Form video: https://www.youtube.com/results?search_query=${encodeURIComponent(item.details.video_query)}`
        : "",
    ].filter(Boolean);

    lines.push(
      "BEGIN:VEVENT",
      `UID:${item.id}@coachin`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${ymdCompact(nextDay)}`,
      `SUMMARY:${escapeIcs(item.title)}`,
      descParts.length > 0
        ? `DESCRIPTION:${escapeIcs(descParts.join("\n"))}`
        : "DESCRIPTION:CoachIn training",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");

  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="coachin-training-plan.ics"',
    },
  });
}
