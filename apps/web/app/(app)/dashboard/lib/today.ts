/** Today page copy and derivations (pure). */

/** First word of a name, for the greeting. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "athlete";
}

/** Up to two initials for the avatar. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** "Thursday, September 24" for an API date (YYYY-MM-DD). */
export function dateLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export const TIER_LABELS: Record<string, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
};

/** 0–100 fill of the level ring. */
export function levelPercent(currentXp: number, nextLevelXp: number): number {
  return nextLevelXp > 0 ? Math.round((currentXp / nextLevelXp) * 100) : 0;
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Subtitle of the training-plan card: "2 active · 3 items today" / "rest day". */
export function planCardSubtitle(activePlans: number, itemsToday: number): string {
  const prefix = activePlans > 1 ? `${activePlans} active · ` : "";
  return prefix + (itemsToday > 0 ? `${plural(itemsToday, "item")} today` : "rest day");
}

/** Multiplier suffix: " (1.2×)" unless it is exactly 1. */
export function multiplierSuffix(multiplier: number): string {
  return multiplier !== 1 ? ` (${multiplier}×)` : "";
}
