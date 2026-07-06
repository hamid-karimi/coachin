"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";

import { useActionToast } from "@/components/hooks/use-action-toast";
import { Button } from "@/components/ui/button";
import {
  discardMealPlanAction,
  generateMealPlanAction,
  type MealPlanActionState,
} from "../plan/actions";

const initialState: MealPlanActionState = {};

function asString(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  return value == null ? "" : String(value);
}

/** Regenerate (resubmits the stored intake) and discard the active plan. */
export function MealPlanActions({
  intake,
}: {
  intake: Record<string, unknown>;
}) {
  const router = useRouter();
  const [regenState, regenAction, regenerating] = useActionState(
    generateMealPlanAction,
    initialState,
  );
  const [discardState, discardAction, discarding] = useActionState(
    discardMealPlanAction,
    initialState,
  );
  useActionToast(regenState);
  useActionToast(discardState);

  const lastRef = useRef<MealPlanActionState>(initialState);
  useEffect(() => {
    const changed =
      regenState !== lastRef.current || discardState !== lastRef.current;
    if (changed && (regenState.success || discardState.success)) {
      router.refresh();
    }
    lastRef.current = regenState.success ? regenState : discardState;
  }, [regenState, discardState, router]);

  const busy = regenerating || discarding;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={regenAction}>
        <input type="hidden" name="goal" value={asString(intake.goal)} />
        <input type="hidden" name="diet" value={asString(intake.diet)} />
        <input
          type="hidden"
          name="allergies"
          value={asString(intake.allergies)}
        />
        <input
          type="hidden"
          name="dislikes"
          value={asString(intake.dislikes)}
        />
        <input
          type="hidden"
          name="meals_per_day"
          value={asString(intake.meals_per_day) || "3"}
        />
        <Button type="submit" variant="outline" disabled={busy}>
          {regenerating ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <RefreshCw aria-hidden />
          )}
          Regenerate
        </Button>
      </form>
      <form action={discardAction}>
        <Button
          type="submit"
          variant="ghost"
          disabled={busy}
          className="text-muted-foreground"
        >
          {discarding ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Trash2 aria-hidden />
          )}
          Discard
        </Button>
      </form>
    </div>
  );
}
