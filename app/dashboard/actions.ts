"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type DashboardActionState = {
  error?: string;
  success?: boolean;
  earnedXp?: number;
  redirect?: string;
};

export async function logoutAction(): Promise<DashboardActionState> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Logout error:", error);
      return { error: error.message };
    }

    revalidatePath("/", "layout");
  } catch (err) {
    console.error("Unexpected logout error:", err);
    return {
      error: err instanceof Error ? err.message : "خطای غیرمنتظره",
    };
  }
  
  redirect("/auth/login");
}

export async function logWorkout(
  _prevState: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const supabase = await createClient();

    // دریافت کاربر فعلی
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.error("No authenticated user found");
      return { error: "کاربر وارد نشده است" };
    }

    if (process.env.NODE_ENV === "development") {
      console.log("✅ Authenticated user ID:", user.id);
    }

    // دریافت اطلاعات از فرم
    const sportId = formData.get("sport_type_id");
    const duration = 60; // مدت زمان پیش‌فرض ۶۰ دقیقه
    const notes = formData.get("notes") as string;
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const date = `${year}-${month}-${day}`;

    if (!sportId) {
      return { error: "لطفا نوع ورزش را انتخاب کنید" };
    }

    if (duration <= 0) {
      return { error: "مدت زمان باید بیشتر از صفر باشد" };
    }

    // 1. دریافت ضریب XP ورزش
    const { data: sport, error: sportError } = await supabase
      .from("sport_types")
      .select("xp_multiplier")
      .eq("id", sportId)
      .single();

    if (sportError || !sport) {
      console.error("Sport fetch error:", sportError);
      return { error: "ورزش مورد نظر یافت نشد" };
    }

    // 2. محاسبه XP
    const earnedXp = Math.round(duration * sport.xp_multiplier);
    console.log("📊 Calculated XP:", {
      duration,
      multiplier: sport.xp_multiplier,
      earnedXp,
    });

    // 3. ثبت در جدول logs
    const logData = {
      user_id: user.id,
      sport_type_id: Number(sportId),
      date: date,
      status: "completed",
      notes: notes || null,
    };

    console.log("📝 Attempting to insert log:", logData);

    const { error: logError } = await supabase.from("logs").insert(logData);

    if (logError) {
      console.error("❌ Error logging workout:", logError);
      console.error("Error code:", logError.code);
      console.error("Error message:", logError.message);
      console.error("Error details:", logError.details);

      if (logError.message.includes("row-level security")) {
        return {
          error:
            "خطا در دسترسی: سیاست محدودیت سطح ردیف (RLS) از ثبت لاگ جلوگیری می‌کند. لطفا سیاست‌های Supabase را بررسی کنید.",
        };
      }

      return { error: `خطا در ثبت ورزش: ${logError.message}` };
    }

    console.log("✅ Workout log inserted successfully");

    // 4. آپدیت پروفایل کاربر (افزایش XP و Level)
    const { data: profile, error: profileFetchError } = await supabase
      .from("profiles")
      .select("xp, current_streak")
      .eq("id", user.id)
      .single();

    if (profileFetchError) {
      console.error("Profile fetch error:", profileFetchError);
      // ادامه می‌دهیم حتی اگر پروفایل نیافتیم
    }

    const currentXp = profile?.xp || 0;
    const newXp = currentXp + earnedXp;
    // فرمول ساده لول: هر 1000 امتیاز یک لول
    const newLevel = Math.floor(newXp / 1000) + 1;

    console.log("📈 Updating profile:", {
      currentXp,
      earnedXp,
      newXp,
      newLevel,
    });

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        xp: newXp,
        level: newLevel,
        // اینجا لاجیک استریک پیچیده‌تره که بعدا با Cron Job هندل می‌کنیم
        // فعلا فقط XP می‌دیم
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("❌ Error updating profile:", updateError);
      console.error("Error code:", updateError.code);
      console.error("Error message:", updateError.message);

      if (updateError.message.includes("row-level security")) {
        return {
          error:
            "خطا در به‌روزرسانی پروفایل: سیاست RLS. ورزش ثبت شد اما امتیاز به‌روز نشد.",
        };
      }

      return {
        error: `ورزش ثبت شد اما خطا در به‌روزرسانی پروفایل: ${updateError.message}`,
      };
    }

    console.log("✅ Profile updated successfully");

    return { success: true, earnedXp };
  } catch (err) {
    console.error("❌ Unexpected error in logWorkout:", err);
    return {
      error: `خطای غیرمنتظره: ${err instanceof Error ? err.message : "نامشخص"}`,
    };
  }
}
