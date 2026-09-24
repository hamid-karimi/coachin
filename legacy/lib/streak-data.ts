import type { createClient } from "@/lib/supabase/server";

/**
 * Settle every un-evaluated past day of the user's personal streak (idempotent,
 * server-side). Call before reading profile streak/hearts on a page load — the
 * same lazy pattern as evaluate_group_days. Best-effort: a failure is logged by
 * the RPC and must never block the page.
 */
export async function settleUserStreak(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<void> {
  await supabase.rpc("evaluate_user_streak");
}
