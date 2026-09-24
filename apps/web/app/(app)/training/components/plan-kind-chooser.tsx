import Link from "next/link";
import type { ComponentType } from "react";
import { ChevronRight, Dumbbell, Medal } from "lucide-react";
import { cn } from "@/lib/utils";

const CHOICES: {
  kind: "race" | "hypertrophy";
  icon: ComponentType<{ className?: string }>;
  tone: string;
  title: string;
  description: string;
}[] = [
  {
    kind: "race",
    icon: Medal,
    tone: "bg-brand-tint text-brand-ink",
    title: "Running",
    description:
      "Start from zero to build a habit, or train for a race — 5k to ultra — with paces, long-run progression, and taper.",
  },
  {
    kind: "hypertrophy",
    icon: Dumbbell,
    tone: "bg-xp-tint text-xp-ink",
    title: "Build muscle",
    description:
      "Hypertrophy or recomposition — a progressive strength split for your equipment, plus mobility and protein guidance.",
  },
];

/** "What are you training for?" — the two plan paths. */
export function PlanKindChooser({ studentId, athleteName }: { studentId?: string; athleteName?: string }) {
  const studentQuery = studentId ? `&student=${studentId}` : "";
  return (
    <div className='mx-auto flex w-full max-w-2xl flex-col gap-5'>
      <div>
        <h1 className='text-foreground font-display text-2xl font-bold tracking-tight md:text-[28px]'>
          {athleteName ? `What is ${athleteName} training for?` : "What are you training for?"}
        </h1>
        <p className='text-muted-foreground text-sm'>
          Both paths generate a week-by-week plan with check-ins that adapt it as you go. Generating replaces any
          existing active plan.
        </p>
      </div>
      {CHOICES.map(({ kind, icon: Icon, tone, title, description }) => (
        <Link
          key={kind}
          href={`/training/new?kind=${kind}${studentQuery}`}
          className='bg-card border-border hover:border-brand/40 group flex items-center gap-4 rounded-2xl border p-5 transition-colors'>
          <span className={cn("grid size-12 shrink-0 place-items-center rounded-xl", tone)}>
            <Icon className='size-6' aria-hidden />
          </span>
          <span className='min-w-0 flex-1'>
            <span className='text-foreground block text-base font-bold'>{title}</span>
            <span className='text-muted-foreground block text-sm'>{description}</span>
          </span>
          <ChevronRight
            className='text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-colors'
            aria-hidden
          />
        </Link>
      ))}
    </div>
  );
}
