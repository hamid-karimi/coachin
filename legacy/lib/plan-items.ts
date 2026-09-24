export interface PlanItemDetails {
  distance_km?: number;
  pace_min_km?: string;
  duration_min?: number;
  notes?: string;
  video_query?: string;
}

/** Compact stat line for a plan item, e.g. "6km · @ 7:45/km · 45min". */
export function planItemDetailLine(details?: PlanItemDetails | null): string {
  return [
    details?.distance_km ? `${details.distance_km}km` : null,
    details?.pace_min_km ? `@ ${details.pace_min_km}/km` : null,
    details?.duration_min ? `${details.duration_min}min` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** YouTube "how-to" search URL for a plan item, or null when none is set. */
export function planItemVideoUrl(details?: PlanItemDetails | null): string | null {
  if (!details?.video_query) return null;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(
    details.video_query,
  )}`;
}

const TYPE_LABEL: Record<string, string> = {
  run: "Run",
  strength: "Strength",
  mobility: "Mobility",
  stretch: "Stretch",
  recovery: "Recovery",
  recovery_active: "Active recovery",
  meal_note: "Meal note",
};

/**
 * Human label for a plan item's `item_type`
 * (e.g. "recovery_active" → "Active recovery"). Unknown types fall back to a
 * de-underscored, capitalised version so this never renders a raw slug.
 */
export function planItemTypeLabel(type: string): string {
  const known = TYPE_LABEL[type];
  if (known) return known;

  const spaced = type.replace(/_/g, " ").trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : "Session";
}
