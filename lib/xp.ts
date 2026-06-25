/**
 * Level progress for the XpBar. Mirrors the dashboard's existing
 * `xp % 1000` logic (see app/dashboard/page.tsx) so behavior is unchanged.
 */
export function levelProgress(xp: number): {
  currentXp: number;
  nextLevelXp: number;
} {
  const safeXp = Number.isFinite(xp) && xp > 0 ? xp : 0;

  return {
    currentXp: safeXp % 1000,
    nextLevelXp: 1000,
  };
}
