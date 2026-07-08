import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { createClient, getUser } from "@/lib/supabase/server";
import { canCoach } from "@/lib/roles";
import { AppShell } from "@/components/design-system/app-shell";
import { getTraineeNutritionData } from "../../../lib/trainee-nutrition-data";
import { TraineeNutritionSection } from "../../../components/TraineeNutritionSection";

export const dynamic = "force-dynamic";

export default async function TraineeNutritionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getUser();
  if (!user) {
    redirect("/auth/login");
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!canCoach(profile?.role)) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const data = await getTraineeNutritionData(supabase, user.id, id);
  if (!data) {
    redirect("/coaching");
  }

  return (
    <AppShell coachNav>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <header>
          <Link
            href="/coaching"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Coaching
          </Link>
          <h1 className="text-foreground font-display text-2xl font-bold tracking-tight md:text-[28px]">
            {data.trainee.name} — nutrition
          </h1>
          <p className="text-muted-foreground text-sm">
            Last 7 days of meal logs, shared by your trainee.
          </p>
        </header>

        <TraineeNutritionSection data={data} />
      </div>
    </AppShell>
  );
}
