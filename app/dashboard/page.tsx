import { createClient, getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AuthContainer } from "../auth/components/auth-container";
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
  const dateString = today.toISOString().split("T")[0];

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
  const isCompleted = (sportId: number) => {
    return todaysLogs?.some((log) => log.sport_type_id === sportId);
  };

  const xpProgress = ((profile?.xp || 0) % 1000) / 10;

  return (
    <AuthContainer>
      <div className='w-full max-w-4xl p-8'>
        <div className='bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8'>
          {/* Header with user info and logout */}
          <div className='flex justify-between items-center mb-8 pb-6 border-b border-slate-200 dark:border-slate-700'>
            <div>
              <h1 className='text-3xl font-bold text-slate-900 dark:text-white'>
                Dashboard
              </h1>
              <p className='text-slate-600 dark:text-slate-400 mt-1'>
                Welcome back, {user.user_metadata.full_name || user.email}!
              </p>
              <p className='text-sm text-slate-500 dark:text-slate-400 mt-2'>
                {DAY_NAMES[dayIndex]}, {dateString}
              </p>
            </div>
            <LogoutButton />
          </div>

          {/* Content */}
          <div className='grid gap-6'>
            <div className='grid gap-4 sm:grid-cols-3'>
              <div className='rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/40 p-4'>
                <p className='text-sm text-slate-600 dark:text-slate-300'>
                  Streak
                </p>
                <p className='text-2xl font-bold text-slate-900 dark:text-white'>
                  {profile?.current_streak || 0}
                </p>
              </div>
              <div className='rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/40 p-4'>
                <p className='text-sm text-slate-600 dark:text-slate-300'>
                  Level
                </p>
                <p className='text-2xl font-bold text-slate-900 dark:text-white'>
                  {profile?.level || 1}
                </p>
              </div>
              <div className='rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/40 p-4'>
                <p className='text-sm text-slate-600 dark:text-slate-300'>
                  Total XP
                </p>
                <p className='text-2xl font-bold text-slate-900 dark:text-white'>
                  {profile?.xp || 0}
                </p>
              </div>
              <div className='rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 sm:col-span-3'>
                <div className='flex justify-between text-sm text-slate-600 dark:text-slate-300'>
                  <span>Progress to next level</span>
                  <span>{Math.round(xpProgress)}%</span>
                </div>
                <div className='mt-3 h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden'>
                  <div
                    className='h-full bg-linear-to-r from-blue-500 to-indigo-500 transition-all duration-500'
                    style={{ width: `${xpProgress}%` }}
                  />
                </div>
              </div>
            </div>

            <div>
              <h2 className='text-2xl font-bold text-slate-900 dark:text-white mb-6'>
                ماموریت‌های امروز
              </h2>

              {!todaysPlan || todaysPlan.length === 0 ? (
                <div className='text-center p-8'>استراحت</div>
              ) : (
                <div className='grid gap-4'>
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
      </div>
    </AuthContainer>
  );
}
