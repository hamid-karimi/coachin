"use client";

import { useActionState, useEffect, useRef } from "react";
import { Clock, Flame } from "lucide-react";

import { logWorkout } from "../actions";
import type { ScheduleItem } from "../page";
import { useActionToast } from "@/components/hooks/use-action-toast";
import { sportFromName } from "@/lib/sports";
import { SportIcon } from "@/components/design-system/sport-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function WorkoutCard({
  item,
  completed = false,
}: {
  item: ScheduleItem;
  completed?: boolean;
}) {
  const [state, action, isPending] = useActionState(logWorkout, {});
  const justCompleted = state?.success;
  const confettiFired = useRef(false);
  useActionToast({
    error: state?.error,
    success: Boolean(state?.success && state?.earnedXp !== undefined),
    message:
      state?.success && state?.earnedXp !== undefined
        ? `Workout logged. +${state.earnedXp} XP earned.`
        : undefined,
  });

  // Fire confetti after successful completion.
  useEffect(() => {
    if (justCompleted && !confettiFired.current) {
      confettiFired.current = true;
      // Dynamic import to avoid SSR issues
      import("canvas-confetti").then((mod) => {
        const confetti = mod.default;
        const duration = 3 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = {
          startVelocity: 30,
          spread: 360,
          ticks: 60,
          zIndex: 0,
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
  const time = item.time ? item.time.slice(0, 5) : "Flexible";

  // If this workout is already completed or just completed now:
  if (completed || justCompleted) {
    return (
      <div className="bg-brand-tint text-brand-ink animate-in fade-in zoom-in flex items-center gap-3 rounded-2xl border border-brand/20 p-6 duration-500">
        <SportIcon sport={sport} />
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            {item.sport_types?.name}
            <Flame className="size-5 text-flame-ink" aria-hidden />
          </h3>
          <p className="mt-1 text-sm">
            {justCompleted ? (
              <>
                Great job! Streak preserved.
                <br />
                <span className="opacity-75">+{state.earnedXp} XP earned.</span>
              </>
            ) : (
              "Done"
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border-border rounded-2xl border p-6 shadow-sm">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <SportIcon sport={sport} />
          <div>
            <h3 className="text-foreground text-xl font-semibold">
              {item.sport_types?.name}
            </h3>
            <p className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" aria-hidden />
                {time}
              </span>
              <Badge variant="xp">{item.sport_types?.xp_multiplier}x XP</Badge>
            </p>
          </div>
        </div>
      </div>

      <form action={action}>
        <input type="hidden" name="sport_type_id" value={item.sport_type_id} />

        <div className="mb-4">
          <Input
            type="text"
            name="notes"
            placeholder="Any notes? (optional)"
          />
        </div>

        <Button
          type="submit"
          variant="brand"
          size="lg"
          className="w-full"
          disabled={isPending}
        >
          {isPending ? "Logging..." : "Done"}
        </Button>
      </form>
    </div>
  );
}
