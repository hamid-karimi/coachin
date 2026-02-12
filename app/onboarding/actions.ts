"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type OnboardingActionState = {
  error?: string;
  success?: boolean;
  redirect?: string;
};

// دریافت لیست ورزش‌ها برای نمایش در دراپ‌داون
export async function getSportTypes() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("sport_types").select("*");

  if (error) throw new Error(error.message);
  return data;
}

// دریافت برنامه‌های کاربر فعلی
export async function getUserSchedules() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("کاربر وارد نشده است");
    }

    const { data, error } = await supabase
      .from("schedules")
      .select("*, sport_types(name)")
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);
    return data || [];
  } catch (err) {
    console.error("Error fetching user schedules:", err);
    return [];
  }
}

// ذخیره یک آیتم در برنامه هفتگی
export async function addScheduleItem(
  _prevState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  try {
    const supabase = await createClient();

    // دریافت کاربر فعلی
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.error("❌ No authenticated user found");
      return { error: "کاربر وارد نشده است" };
    }

    console.log("✅ Authenticated user:", {
      id: user.id,
      email: user.email,
    });

    const sportId = formData.get("sport_type_id");
    const dayOfWeek = formData.get("day_of_week");
    const time = formData.get("time"); // فرمت HH:MM

    if (!sportId || !dayOfWeek) {
      return { error: "لطفا تمام فیلدهای مورد نیاز را پر کنید" };
    }

    const insertData = {
      user_id: user.id,
      sport_type_id: Number(sportId),
      day_of_week: Number(dayOfWeek),
      time: time ? String(time) : null,
    };

    console.log("📝 Attempting to insert:", insertData);

    const { data, error } = await supabase.from("schedules").insert(insertData);

    if (error) {
      console.error("❌ Supabase insert error:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      console.error("Error details:", error.details);
      console.error("Error hint:", error.hint);

      // Check if it's an RLS policy error
      if (error.message.includes("row-level security")) {
        return {
          error: `خطا در دسترسی: سیاست محدودیت سطح ردیف (RLS) از اضافه کردن داده جلوگیری می‌کند. لطفا سیاست های Supabase را بررسی کنید.`,
        };
      }

      return {
        error: `خطا در ذخیره برنامه: ${error.message || "خطای نامشخص"}. لطفا دوباره تلاش کنید یا با پشتیبان تماس بگیرید.`,
      };
    }

    console.log("✅ Schedule item inserted successfully:", data);
    revalidatePath("/onboarding");
    return { success: true };
  } catch (err) {
    console.error("❌ Unexpected error adding schedule:", err);
    return {
      error: `خطای غیرمنتظره: ${err instanceof Error ? err.message : "نامشخص"}`,
    };
  }
}

// حذف یک آیتم (برای اینکه کاربر بتونه اصلاح کنه)
export async function deleteScheduleItem(
  _prevState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  try {
    const scheduleId = formData.get("scheduleId") as string;

    if (!scheduleId) {
      return { error: "شناسه برنامه مشخص نشده است" };
    }

    const supabase = await createClient();

    // تأیید اینکه کاربر وارد شده است
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "کاربر وارد نشده است" };
    }

    console.log("🗑️ Attempting to delete schedule:", {
      scheduleId,
      userId: user.id,
    });

    const { error } = await supabase
      .from("schedules")
      .delete()
      .eq("id", scheduleId);

    if (error) {
      console.error("❌ Error deleting schedule:", error);
      if (error.message.includes("row-level security")) {
        return { error: "خطا در دسترسی: شما مجاز به حذف این برنامه نیستید" };
      }
      return { error: "مشکلی در حذف برنامه پیش آمد." };
    }

    console.log("✅ Schedule deleted successfully");
    revalidatePath("/onboarding");
    return { success: true };
  } catch (err) {
    console.error("❌ Unexpected error deleting schedule:", err);
    return { error: "خطای غیرمنتظره رخ داد" };
  }
}

// پایان تنظیمات و رفتن به داشبورد
export async function completeOnboarding(): Promise<OnboardingActionState> {
  return { success: true, redirect: "/dashboard" };
}
