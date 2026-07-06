import {
  Activity,
  BedDouble,
  Dumbbell,
  Footprints,
  UtensilsCrossed,
} from "lucide-react";
import type { ComponentType } from "react";

type IconType = ComponentType<{ className?: string }>;

// Maps a plan item's `item_type` to an icon. Kept alongside the cards (not in
// lib) because icons are a UI concern; the label lives in lib/plan-items.
const TYPE_ICON: Record<string, IconType> = {
  run: Footprints,
  strength: Dumbbell,
  mobility: Activity,
  stretch: Activity,
  recovery: BedDouble,
  recovery_active: Footprints,
  meal_note: UtensilsCrossed,
};

/** Renders the icon for a plan item's `item_type`, defaulting to a generic mark. */
export function PlanTypeIcon({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  const Icon = TYPE_ICON[type] ?? Activity;
  return <Icon className={className} aria-hidden />;
}
