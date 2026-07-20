/**
 * Progress-photo nudge rule (share-progress plan phase 2, documented in
 * FORMULAS.md §15). Quiet by design: a dashboard link only — no XP, no badge,
 * dismissed by taking a photo.
 */

export const PROGRESS_PHOTO_NUDGE_DAYS = 28;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Nudge active users (a live streak or any log this week) whose newest
 * journal photo is more than 28 days old — or who have none yet.
 */
export function isProgressPhotoDue(input: {
  currentStreak: number;
  weekLogCount: number;
  lastPhotoAt: Date | null;
  today: Date;
}): boolean {
  const active = input.currentStreak > 0 || input.weekLogCount > 0;
  if (!active) return false;
  if (!input.lastPhotoAt) return true;
  return (
    input.today.getTime() - input.lastPhotoAt.getTime() >
    PROGRESS_PHOTO_NUDGE_DAYS * DAY_MS
  );
}
