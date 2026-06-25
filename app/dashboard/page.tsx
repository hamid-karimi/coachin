import { createClient, getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Flame } from "lucide-react";

import { AppShell } from "@/components/design-system/app-shell";
import { XpBar } from "@/components/design-system/xp-bar";
import { StatCard } from "@/components/design-system/stat-card";
import { levelProgress } from "@/lib/xp";
import { LogoutButton } from "./logout-button";
import { WorkoutCard } from "./components/workout-card";

export const dynamic = "force-dynamic";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

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

  const name = user.user_metadata.full_name || user.email;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl">
        {/* Header */}
        <div className="border-border mb-8 flex items-start justify-between gap-4 border-b pb-6">
          <div>
            <h1 className="text-foreground text-3xl font-bold">
              {greeting(today.getHours())}, {name}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {DAY_NAMES[dayIndex]}, {dateString}
            </p>
          </div>
          <LogoutButton />
        </div>

        <div className="grid gap-6">
          {/* XP / Level progress */}
          <div className="bg-card border-border rounded-2xl border p-6">
            <XpBar
              level={profile.level ?? 1}
              {...levelProgress(profile.xp ?? 0)}
            />
          </div>

          {/* Stat row */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Streak"
              value={profile.current_streak ?? 0}
              accent="flame"
              icon={<Flame className="size-5" aria-hidden />}
            />
            <StatCard label="Level" value={profile.level ?? 1} />
            <StatCard label="Total XP" value={profile.xp ?? 0} />
          </div>

          {/* Today's plan */}
          <div>
            <h2 className="text-foreground mb-6 text-2xl font-bold">
              Today&apos;s plan
            </h2>

            {!todaysPlan || todaysPlan.length === 0 ? (
              <div className="bg-secondary text-muted-foreground rounded-2xl p-8 text-center">
                Rest day — no sessions scheduled.
              </div>
            ) : (
              <div className="grid gap-4">
                {todaysPlan.map((item: ScheduleItem) => {
                  const completed = isCompleted(item.sport_type_id);

                  return (
                    <WorkoutCard
                      key={item.id}
                      item={item}
                      completed={completed}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
