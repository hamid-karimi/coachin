"use client";

import { useActionState } from "react";
import { Loader2, Salad } from "lucide-react";

import { useActionToast } from "@/components/hooks/use-action-toast";
import { Button } from "@/components/ui/button";
import {
  setNutritionSharingAction,
  type ProfileActionState,
} from "../actions";

const initialState: ProfileActionState = {};

interface NutritionSharingToggleProps {
  /** Current value of profiles.nutrition_sharing_enabled. */
  enabled: boolean;
}

/** Trainee opt-in switch for coach nutrition access. Submitting flips the
 *  flag; the server re-renders the section with the new state. */
export function NutritionSharingToggle({
  enabled,
}: NutritionSharingToggleProps) {
  const [state, formAction, pending] = useActionState(
    setNutritionSharingAction,
    initialState,
  );
  useActionToast(state);

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <Salad className="text-brand-ink size-4 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="text-foreground text-sm font-medium">
            Share nutrition with my coach
          </p>
          <p className="text-muted-foreground text-xs">
            {enabled
              ? "Your coach can see your meal logs and meal plan."
              : "Off — only you can see your meal logs and meal plan."}
          </p>
        </div>
      </div>
      <form action={formAction}>
        <input
          type="hidden"
          name="enabled"
          value={enabled ? "false" : "true"}
        />
        <Button
          type="submit"
          size="sm"
          variant={enabled ? "secondary" : "brand"}
          disabled={pending}
        >
          {pending ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : enabled ? (
            "Turn off"
          ) : (
            "Turn on"
          )}
        </Button>
      </form>
    </div>
  );
}
