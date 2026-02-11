import { createClient, getUser } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";
import { AuthContainer } from "../auth/components/auth-container";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const supabase = await createClient();
  const { data: sportTypes, error } = await supabase
    .from("sport_types")
    .select("*");

  return (
    <AuthContainer>
      <div className="w-full max-w-4xl p-8">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8">
          {/* Header with user info and logout */}
          <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-200 dark:border-slate-700">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                Dashboard
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                Welcome back, {user.email}
              </p>
            </div>
            <LogoutButton />
          </div>

          {/* Content */}
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
              Sport Types 🏃‍♂️
            </h2>

            {error ? (
              <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-800 dark:text-red-200">
                  Error: {error.message}
                </p>
              </div>
            ) : sportTypes && sportTypes.length > 0 ? (
              <div className="grid gap-4">
                {sportTypes.map((sport) => (
                  <div
                    key={sport.id}
                    className="flex justify-between items-center p-5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 hover:shadow-md transition-shadow"
                  >
                    <span className="text-lg font-medium text-slate-900 dark:text-white">
                      {sport.name}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 font-medium text-sm">
                      x{sport.xp_multiplier}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-slate-500 dark:text-slate-400">
                  No sport types found
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AuthContainer>
  );
}
 