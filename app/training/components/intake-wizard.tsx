"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  FileUp,
  Loader2,
  Sparkles,
  Wand2,
} from "lucide-react";

import { useActionToast } from "@/components/hooks/use-action-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  raceDistanceKm,
  suggestGoalForDistance,
  RACE_TARGETS,
  type RaceTarget,
} from "@/lib/running";
import type { ActivitySummary } from "@/lib/activity-parse";
import {
  generatePlanAction,
  parseActivitiesAction,
  type MarathonActionState,
} from "../actions";

const initialState: MarathonActionState = {};

const EXPERIENCE_LEVELS = [
  ["new", "New to running", "Starting from zero or walk/run"],
  ["recreational", "Recreational", "I run casually, no structured training"],
  ["regular", "Regular racer", "I train consistently and have raced"],
  ["competitive", "Competitive", "High volume, structured training"],
] as const;

const selectClassName =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-md border px-3 py-1 text-sm outline-none focus-visible:ring-[3px]";

interface IntakeWizardProps {
  profileSummary: string;
  hasBodyProfile: boolean;
}

export function IntakeWizard({
  profileSummary,
  hasBodyProfile,
}: IntakeWizardProps) {
  const [step, setStep] = useState(1);
  const [generateState, generateAction, generating] = useActionState(
    generatePlanAction,
    initialState,
  );
  const [parseState, parseAction, parsing] = useActionState(
    parseActivitiesAction,
    initialState,
  );
  useActionToast(generateState);
  useActionToast(parseState);

  const [raceTarget, setRaceTarget] = useState<RaceTarget>("full");
  const [customKm, setCustomKm] = useState("");
  const [pbs, setPbs] = useState({
    pb_5k: "",
    pb_10k: "",
    pb_half: "",
    pb_full: "",
  });
  const [goalTime, setGoalTime] = useState("");
  const activities: ActivitySummary[] = parseState.activities ?? [];

  const needsCustomKm = raceTarget === "ultra" || raceTarget === "other";
  const targetKm = raceDistanceKm(
    raceTarget,
    needsCustomKm ? Number(customKm) : null,
  );
  const targetLabel =
    RACE_TARGETS.find((entry) => entry.value === raceTarget)?.label ?? "race";
  const hasAnyPb = Object.values(pbs).some((value) => value.trim() !== "");

  const suggestGoal = () => {
    if (!targetKm) return;
    const suggestion = suggestGoalForDistance(pbs, targetKm);
    if (suggestion) setGoalTime(suggestion);
  };

  const stepLabel = [
    "",
    "About you",
    "Running background",
    "Your goal",
    "Watch data",
  ][step];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-brand-ink text-[13px] font-semibold">
          Step {step} of 4 · {stepLabel}
        </p>
        <div className="flex gap-1.5" aria-hidden>
          {[1, 2, 3, 4].map((index) => (
            <span
              key={index}
              className={`h-1.5 w-8 rounded-full ${index <= step ? "bg-brand" : "bg-secondary"}`}
            />
          ))}
        </div>
      </div>

      {/* Watch-file upload lives OUTSIDE the main form (forms can't nest). */}
      {step === 4 && (
        <div className="bg-card border-border space-y-3 rounded-xl border p-4">
          <form action={parseAction} className="space-y-3">
            <Label htmlFor="activities">
              Optional: upload recent runs (.fit or .gpx, up to 3 files)
            </Label>
            <div className="flex flex-wrap items-center gap-3">
              <Input
                id="activities"
                name="activities"
                type="file"
                accept=".fit,.gpx"
                multiple
                className="max-w-xs"
              />
              <Button type="submit" variant="outline" disabled={parsing}>
                {parsing ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <FileUp aria-hidden />
                )}
                Parse files
              </Button>
            </div>
          </form>

          {activities.length > 0 && (
            <ul className="text-muted-foreground space-y-1 text-sm">
              {activities.map((activity, index) => (
                <li key={`${activity.date}-${index}`}>
                  {activity.date}: {activity.distance_km}km ·{" "}
                  {activity.duration_min}min
                  {activity.avg_hr ? ` · ${activity.avg_hr} bpm` : ""}
                </li>
              ))}
            </ul>
          )}

          <details className="text-muted-foreground text-xs">
            <summary className="text-foreground cursor-pointer font-medium">
              How do I export files from my watch?
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Garmin: connect.garmin.com → activity → gear icon → Export to
                GPX (or Export Original for .fit).
              </li>
              <li>
                Apple Watch: use an app like HealthFit or RunGap to export
                workouts as GPX.
              </li>
              <li>
                Strava: activity page → ⋯ menu → Export GPX.
              </li>
              <li>Suunto / COROS: their web apps offer GPX export per workout.</li>
            </ul>
          </details>
        </div>
      )}

      <form action={generateAction} className="space-y-4">
        {/* Step 1 — about you (profile snapshot) */}
        <div className={step === 1 ? "space-y-4" : "hidden"}>
          <div className="bg-card border-border space-y-3 rounded-xl border p-4">
            <p className="text-foreground text-sm font-semibold">
              We&apos;ll personalize with your profile
            </p>
            <p className="text-muted-foreground text-sm">{profileSummary}</p>
            {!hasBodyProfile && (
              <p className="text-flame-ink text-xs">
                Your body profile is incomplete —{" "}
                <Link href="/profile" className="underline">
                  fill it in
                </Link>{" "}
                for a better plan (age, sex, height, weight).
              </p>
            )}
          </div>
        </div>

        {/* Step 3 — your goal (distance, experience, race date, goal time) */}
        <div className={step === 3 ? "space-y-4" : "hidden"}>
          <div className="bg-card border-border space-y-4 rounded-xl border p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="race_target">Race distance</Label>
                <select
                  id="race_target"
                  name="race_target"
                  value={raceTarget}
                  onChange={(event) =>
                    setRaceTarget(event.target.value as RaceTarget)
                  }
                  className={selectClassName}
                >
                  {RACE_TARGETS.map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </div>
              {needsCustomKm && (
                <div className="space-y-1.5">
                  <Label htmlFor="custom_distance_km">Distance (km)</Label>
                  <Input
                    id="custom_distance_km"
                    name="custom_distance_km"
                    type="number"
                    min={1}
                    max={500}
                    step="0.1"
                    placeholder={raceTarget === "ultra" ? "50" : "25"}
                    value={customKm}
                    onChange={(event) => setCustomKm(event.target.value)}
                    required
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="experience_level">
                Where are you on your running journey?
              </Label>
              <select
                id="experience_level"
                name="experience_level"
                defaultValue="recreational"
                className={selectClassName}
              >
                {EXPERIENCE_LEVELS.map(([value, label, hint]) => (
                  <option key={value} value={value}>
                    {label} — {hint}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="race_date">Race date</Label>
                <Input id="race_date" name="race_date" type="date" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="goal_time">Goal time (optional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="goal_time"
                    name="goal_time"
                    placeholder={raceTarget === "5k" ? "25:00" : "3:59:00"}
                    value={goalTime}
                    onChange={(event) => setGoalTime(event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={suggestGoal}
                    disabled={!hasAnyPb || !targetKm}
                    title={
                      hasAnyPb
                        ? "Suggest from your PBs (Riegel formula)"
                        : "Add a personal best in the previous step to get a suggestion"
                    }
                  >
                    <Wand2 aria-hidden />
                    Suggest
                  </Button>
                </div>
              </div>
            </div>

            <p className="text-muted-foreground text-xs">
              First {targetLabel.toLowerCase()}? Leave the goal time empty —
              the plan will target a strong, healthy finish instead of a time.
            </p>
          </div>
        </div>

        {/* Step 2 — running background */}
        <div className={step === 2 ? "space-y-4" : "hidden"}>
          <div className="bg-card border-border space-y-4 rounded-xl border p-4">
            <p className="text-foreground text-sm font-semibold">
              Personal bests (leave blank if none)
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ["pb_5k", "5k", "22:30"],
                  ["pb_10k", "10k", "47:00"],
                  ["pb_half", "Half", "1:45:00"],
                  ["pb_full", "Marathon", "3:59:00"],
                ] as const
              ).map(([name, label, placeholder]) => (
                <div key={name} className="space-y-1.5">
                  <Label htmlFor={name}>{label}</Label>
                  <Input
                    id={name}
                    name={name}
                    placeholder={placeholder}
                    value={pbs[name]}
                    onChange={(event) =>
                      setPbs((current) => ({
                        ...current,
                        [name]: event.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="weekly_km">Weekly km now</Label>
                <Input
                  id="weekly_km"
                  name="weekly_km"
                  type="number"
                  min={0}
                  step="1"
                  placeholder="30"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="longest_run_km">Longest recent run (km)</Label>
                <Input
                  id="longest_run_km"
                  name="longest_run_km"
                  type="number"
                  min={0}
                  step="1"
                  placeholder="15"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="days_per_week">Training days / week</Label>
                <select
                  id="days_per_week"
                  name="days_per_week"
                  defaultValue="4"
                  className={selectClassName}
                >
                  {[2, 3, 4, 5, 6, 7].map((days) => (
                    <option key={days} value={days}>
                      {days}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="injuries">Injuries or limitations (optional)</Label>
              <textarea
                id="injuries"
                name="injuries"
                rows={2}
                maxLength={500}
                placeholder="Example: right knee gets sore over 25km/week"
                className="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
              />
            </div>
          </div>
        </div>

        {/* Step 4 — review + generate (upload form renders above) */}
        <div className={step === 4 ? "space-y-4" : "hidden"}>
          <input
            type="hidden"
            name="activities_json"
            value={JSON.stringify(activities)}
          />
          <div className="bg-card border-border space-y-2 rounded-xl border p-4">
            <p className="text-foreground text-sm font-semibold">
              Ready to generate your {targetLabel.toLowerCase()} plan
            </p>
            <p className="text-muted-foreground text-sm">
              {activities.length > 0
                ? `${activities.length} uploaded ${activities.length === 1 ? "run" : "runs"} will inform your paces.`
                : "No watch data — the plan uses your answers and PBs."}{" "}
              Generation takes ~15 seconds and replaces any existing active
              plan.
            </p>
          </div>
        </div>

        {/* Wizard navigation */}
        <div className="flex items-center justify-between">
          {step > 1 ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep((current) => current - 1)}
            >
              <ArrowLeft aria-hidden />
              Back
            </Button>
          ) : (
            <span />
          )}
          {step < 4 ? (
            <Button
              type="button"
              variant="brand"
              onClick={() => setStep((current) => current + 1)}
            >
              Continue
              <ArrowRight aria-hidden />
            </Button>
          ) : (
            <Button type="submit" variant="brand" disabled={generating}>
              {generating ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Sparkles aria-hidden />
              )}
              {generating ? "Generating your plan…" : "Generate my plan"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
