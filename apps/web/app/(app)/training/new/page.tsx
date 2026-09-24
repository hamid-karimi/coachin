import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getIntakeContext } from "@/app/lib/intake-data";
import { HypertrophyWizard } from "../components/hypertrophy-wizard";
import { PlanKindChooser } from "../components/plan-kind-chooser";
import { RunningWizard } from "../components/running-wizard";
import { hasBodyProfile, PLAN_KIND_COPY, planKindFrom, profileSummary } from "../lib/intake";

export const metadata: Metadata = { title: "New plan · CoachIn" };

type SearchParams = Promise<{ kind?: string | string[]; student?: string | string[] }>;

export default async function NewPlanPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const student = typeof params.student === "string" ? params.student.trim() || undefined : undefined;
  const intake = await getIntakeContext(student);
  // Coach mode for someone you don't coach: back to your own plan choice.
  if (!intake) redirect(student ? "/coaching" : "/training/new");

  const studentId = intake.forStudent ? student : undefined;
  const kind = planKindFrom(params.kind);
  if (!kind) return <PlanKindChooser studentId={studentId} athleteName={intake.athleteName || undefined} />;

  const copy = PLAN_KIND_COPY[kind];
  const Wizard = kind === "race" ? RunningWizard : HypertrophyWizard;
  return (
    <div className='mx-auto flex w-full max-w-2xl flex-col gap-5'>
      <div>
        <h1 className='text-foreground font-display text-2xl font-bold tracking-tight md:text-[28px]'>
          {copy.title}
          {intake.forStudent ? ` for ${intake.athleteName}` : ""}
        </h1>
        {intake.forStudent && (
          <p className='text-brand-ink text-sm font-medium'>
            Coach mode — this plan is generated for {intake.athleteName} and replaces their active plan right away.
          </p>
        )}
        <p className='text-muted-foreground text-sm'>{copy.description}</p>
      </div>
      <Wizard profileSummary={profileSummary(intake)} hasBodyProfile={hasBodyProfile(intake)} targetStudentId={studentId} />
    </div>
  );
}
