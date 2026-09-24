/** Item types that count as a "hard" session for collision warnings. */
const HARD_ITEM_TYPES = new Set(["run", "strength"]);

/**
 * True when a single day holds 2+ hard sessions (`run`/`strength`) across all
 * active plans — the signal for the soft "consider spacing them" warning.
 * Blending items from multiple plans can land two hard sessions on one date;
 * this flags that so the daily/calendar surfaces can nudge the user.
 */
export function hasHardCollision(items: { item_type: string }[]): boolean {
  let hard = 0;
  for (const item of items) {
    if (HARD_ITEM_TYPES.has(item.item_type)) {
      hard += 1;
      if (hard >= 2) return true;
    }
  }
  return false;
}
