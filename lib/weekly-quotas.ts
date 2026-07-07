/**
 * Weekly quota progress — pure math for "sport × N sessions/week" targets.
 * See FORMULAS.md § Weekly quotas. Framework-free; unit-tested in
 * `lib/weekly-quotas.test.ts`.
 */

export type WeeklyQuotaTarget = {
  sport_type_id: number;
  sessions_per_week: number;
};

export type QuotaLog = {
  sport_type_id: number | null;
  date: string; // YYYY-MM-DD
  status: string; // public.log_status: completed | skipped | missed
};

export type QuotaProgress = {
  sport_type_id: number;
  target: number;
  done: number;
};

/**
 * Progress toward each weekly quota. `done` = count of DISTINCT dates that
 * have a completed log of that sport — two logs of the same sport on one day
 * count as a single session, mirroring the streak's day-based counting.
 *
 * Contract: the caller passes only the logs of the week under review (Mon–Sun,
 * local dates). This helper does NO date-window math — it trusts the slice it
 * is given, which is what lets it score past weeks too.
 *
 * `done` is the raw distinct-day count and may exceed `target`; capping the
 * display at the target is a UI concern.
 */
export function quotaProgress(
  quotas: WeeklyQuotaTarget[],
  logs: QuotaLog[],
): QuotaProgress[] {
  const daysBySport = new Map<number, Set<string>>();
  for (const log of logs) {
    if (log.status !== "completed" || log.sport_type_id === null) continue;
    const days = daysBySport.get(log.sport_type_id) ?? new Set<string>();
    days.add(log.date);
    daysBySport.set(log.sport_type_id, days);
  }

  return quotas.map((quota) => ({
    sport_type_id: quota.sport_type_id,
    target: quota.sessions_per_week,
    done: daysBySport.get(quota.sport_type_id)?.size ?? 0,
  }));
}
