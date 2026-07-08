"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { toLocalYMD } from "@/lib/dates";

export type SupplementActionState = {
  error?: string;
  success?: boolean;
  message?: string;
  status?: "success" | "info" | "error";
};

const MAX_SUPPLEMENTS = 20;

/** Add a supplement to the daily stack (name + optional dose text). */
export async function addSupplementAction(
  _prevState: SupplementActionState,
  formData: FormData,
): Promise<SupplementActionState> {
  const user = await getUser();
  if (!user) return { error: "You must be signed in" };

  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  if (!name) return { error: "Give the supplement a name" };
  const dose = String(formData.get("dose") ?? "").trim().slice(0, 40) || null;

  const supabase = await createClient();
  const { count } = await supabase
    .from("supplements")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) >= MAX_SUPPLEMENTS) {
    return { error: `Keep the stack under ${MAX_SUPPLEMENTS} items` };
  }

  const { error } = await supabase
    .from("supplements")
    .insert({ user_id: user.id, name, dose });
  if (error) {
    console.error("supplement insert failed:", error);
    return { error: "Failed to add the supplement" };
  }

  revalidatePath("/dashboard");
  return { success: true, message: `${name} added to your daily stack.` };
}

/** Remove a supplement (its logs cascade away with it). */
export async function deleteSupplementAction(
  _prevState: SupplementActionState,
  formData: FormData,
): Promise<SupplementActionState> {
  const user = await getUser();
  if (!user) return { error: "You must be signed in" };

  const supplementId = String(formData.get("supplement_id") ?? "").trim();
  if (!supplementId) return { error: "Missing supplement id" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("supplements")
    .delete()
    .eq("id", supplementId)
    .eq("user_id", user.id);
  if (error) {
    console.error("supplement delete failed:", error);
    return { error: "Failed to remove the supplement" };
  }

  revalidatePath("/dashboard");
  return { success: true, message: "Removed.", status: "info" };
}

/** Toggle today's taken-state for a supplement. Idempotent per day via the
 *  (supplement_id, date) unique constraint. NO XP — informational habit only
 *  (FORMULAS.md §13). */
export async function toggleSupplementLogAction(
  _prevState: SupplementActionState,
  formData: FormData,
): Promise<SupplementActionState> {
  const user = await getUser();
  if (!user) return { error: "You must be signed in" };

  const supplementId = String(formData.get("supplement_id") ?? "").trim();
  if (!supplementId) return { error: "Missing supplement id" };
  const taken = String(formData.get("taken") ?? "") === "true";
  const today = toLocalYMD(new Date());

  const supabase = await createClient();
  if (taken) {
    const { error } = await supabase.from("supplement_logs").insert({
      user_id: user.id,
      supplement_id: supplementId,
      date: today,
    });
    // 23505 = already logged today (double-tap) — treat as success.
    if (error && error.code !== "23505") {
      console.error("supplement log failed:", error);
      return { error: "Failed to log the supplement" };
    }
  } else {
    const { error } = await supabase
      .from("supplement_logs")
      .delete()
      .eq("supplement_id", supplementId)
      .eq("user_id", user.id)
      .eq("date", today);
    if (error) {
      console.error("supplement unlog failed:", error);
      return { error: "Failed to update the supplement" };
    }
  }

  revalidatePath("/dashboard");
  return { success: true };
}
