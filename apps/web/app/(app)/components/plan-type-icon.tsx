import type { ComponentType } from "react";
import { Activity, BedDouble, Dumbbell, Footprints, UtensilsCrossed } from "lucide-react";

type IconType = ComponentType<{ className?: string }>;

// Icons are a UI concern, so this map lives with the cards; labels are in lib/plan-items.
const TYPE_ICON: Record<string, IconType> = {
  run: Footprints,
  strength: Dumbbell,
  mobility: Activity,
  stretch: Activity,
  recovery: BedDouble,
  recovery_active: Footprints,
  meal_note: UtensilsCrossed,
};

/** The icon for a plan item's `itemType`, defaulting to a generic mark. */
export function PlanTypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = TYPE_ICON[type] ?? Activity;
  return <Icon className={className} aria-hidden />;
}
