"use client";

import { useActionState, useEffect, useRef } from "react";
import { Check, Flame } from "lucide-react";

import { logWorkout } from "../actions";
import type { ScheduleItem } from "../page";
import { useActionToast } from "@/components/hooks/use-action-toast";
import { sportFromName } from "@/lib/sports";
import { SportIcon } from "@/components/design-system/sport-chip";
import { Button } from "@/components/ui/button";

// Volt + ember — the celebration palette.
const CONFETTI_COLORS = ["#D4F531", "#FF5C1F", "#FFB03A", "#FFC14D", "#5EB8FF"];

export function WorkoutCard({
  item,
  completed = false,
  streak = 0,
  bestStreak = 0,
}: {
  item: ScheduleItem;
  completed?: boolean;
  streak?: number;
  bestStreak?: number;
}) {
  const [state, action, isPending] = useActionState(logWorkout, {});
  const justCompleted = state?.success;
  const confettiFired = useRef(false);
  useActionToast({
    error: state?.error,
  });

  // Fire confetti after successful completion.
  useEffect(() => {
    if (justCompleted && !confettiFired.current) {
      confettiFired.current = true;
      // Dynamic import to avoid SSR issues
      import("canvas-confetti").then((mod) => {
        const confetti = mod.default;
        const duration = 2 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = {
          startVelocity: 30,
          spread: 360,
          ticks: 60,
          zIndex: 50,
          colors: CONFETTI_COLORS,
        };

        const randomInRange = (min: number, max: number) =>
          Math.random() * (max - min) + min;

        const interval: ReturnType<typeof setInterval> = setInterval(
          function () {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
              clearInterval(interval);
              return;
            }

            const particleCount = 50 * (timeLeft / duration);
            confetti({
              ...defaults,
              particleCount,
              origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
            });
            confetti({
              ...defaults,
              particleCount,
              origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
            });
          },
          250,
        );

        return () => clearInterval(interval);
      });
    }
  }, [justCompleted]);

  const sport = sportFromName(item.sport_types?.name);
  const time = item.time ? item.time.slice(0, 5) : null;
  const multiplier = Number(item.sport_types?.xp_multiplier ?? 1) || 1;
  const estimatedXp = Math.round(60 * multiplier);

  // Freshly logged: the reward moment — XP earned, streak status, what's next.
  if (justCompleted) {
    const nextStreak = streak + 1;
    return (
      <div className="bg-success-tint border-success/25 animate-in fade-in zoom-in-95 rounded-xl border p-4 duration-500">
        <div className="flex items-center gap-3.5">
          <span className="bg-success/15 text-success grid size-11 shrink-0 place-items-center rounded-lg">
            <Check className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-foreground text-[15px] font-semibold">
              {item.sport_types?.name} logged!
            </p>
            <p className="text-success text-[13px] font-semibold">
              +{state.earnedXp} XP earned
              {multiplier !== 1 ? ` (${multiplier}×)` : ""}
            </p>
          </div>
          <span className="text-brand-ink text-stat text-xl">
            +{state.earnedXp}
          </span>
        </div>
        <div className="border-success/20 mt-3 flex items-center gap-2 border-t pt-3">
          <Flame className="text-flame fill-flame/30 size-4" aria-hidden />
          <p className="text-muted-foreground text-[13px]">
            <span className="text-foreground font-semibold">
              Streak: {nextStreak} {nextStreak === 1 ? "day" : "days"}
            </span>
            {bestStreak > 0 && ` · best ${Math.max(bestStreak, nextStreak)}`}
          </p>
        </div>
      </div>
    );
  }

  // Already completed earlier today.
  if (completed) {
    return (
      <div className="bg-success-tint border-success/25 flex items-center gap-3.5 rounded-xl border p-4">
        <span className="bg-success/15 text-success grid size-11 shrink-0 place-items-center rounded-lg">
          <Check className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-foreground/80 truncate text-[15px] font-semibold line-through decoration-foreground/40">
            {item.sport_types?.name}
          </p>
          <p className="text-success text-[13px] font-semibold">
            Done · +{estimatedXp} XP
            {multiplier !== 1 ? ` (${multiplier}×)` : ""}
          </p>
        </div>
      </div>
    );
  }

  // Pending: the #1 daily action — one tap, no extra fields.
  return (
    <div className="bg-card border-border flex items-center gap-3.5 rounded-xl border p-4">
      <SportIcon sport={sport} />
      <div className="min-w-0 flex-1">
        <p className="text-foreground truncate text-[15px] font-semibold">
          {item.sport_types?.name}
        </p>
        <p className="text-muted-foreground text-[13px]">
          {time ? `${time} · ` : ""}+{estimatedXp} XP
          {multiplier !== 1 && (
            <span className="text-brand-ink font-semibold">
              {" "}
              · {multiplier}×
            </span>
          )}
        </p>
      </div>
      <form action={action}>
        <input type="hidden" name="sport_type_id" value={item.sport_type_id} />
        <Button type="submit" variant="brand" disabled={isPending}>
          {isPending ? "Logging…" : "Log it"}
        </Button>
      </form>
    </div>
  );
}
