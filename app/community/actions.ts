"use server";

import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CommunityActionState = {
  error?: string;
  success?: boolean;
  message?: string;
};

const COACH_ENABLED_ROLES = new Set(["coach", "both", "admin"]);
const STUDENT_ENABLED_ROLES = new Set(["student", "both", "admin"]);

function normalizeCode(raw: string) {
  return raw.trim().toUpperCase();
}

function randomChunk(length = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let output = "";

  for (let i = 0; i < length; i += 1) {
    output += alphabet[randomInt(0, alphabet.length)];
  }

  return output;
}

async function getCurrentUserAndRole() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, role: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return {
    supabase,
    user,
    role: (profile?.role ?? "student") as string,
  };
}

export async function generateCoachInviteCodeAction(
  _prevState: CommunityActionState,
  formData: FormData,
): Promise<CommunityActionState> {
  const sportTypeIdValue = formData.get("sport_type_id");
  const sportTypeId = Number(sportTypeIdValue);

  if (!sportTypeId || Number.isNaN(sportTypeId)) {
    return { error: "نوع ورزش معتبر نیست" };
  }

  const { supabase, user, role } = await getCurrentUserAndRole();

  if (!user) {
    return { error: "برای این عملیات باید وارد حساب شوید" };
  }

  if (!COACH_ENABLED_ROLES.has(role ?? "")) {
    return { error: "نقش فعلی شما اجازه ساخت کد مربیگری ندارد" };
  }

  const code = normalizeCode(`COACH-${sportTypeId}-${randomChunk(6)}`);

  const { error } = await supabase.from("coach_invite_codes").upsert(
    {
      coach_id: user.id,
      sport_type_id: sportTypeId,
      code,
      is_active: true,
      expires_at: null,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "coach_id,sport_type_id",
      ignoreDuplicates: false,
    },
  );

  if (error) {
    return { error: `خطا در ساخت کد دعوت: ${error.message}` };
  }

  revalidatePath("/community");

  return {
    success: true,
    message: `کد دعوت جدید ساخته شد: ${code}`,
  };
}

export async function connectCoachByCodeAction(
  _prevState: CommunityActionState,
  formData: FormData,
): Promise<CommunityActionState> {
  const rawCode = formData.get("invite_code");
  const code = normalizeCode(String(rawCode ?? ""));

  if (!code) {
    return { error: "کد دعوت را وارد کنید" };
  }

  const { supabase, user, role } = await getCurrentUserAndRole();

  if (!user) {
    return { error: "برای این عملیات باید وارد حساب شوید" };
  }

  if (!STUDENT_ENABLED_ROLES.has(role ?? "")) {
    return { error: "نقش فعلی شما اجازه افزودن مربی ندارد" };
  }

  const { data: result, error: rpcError } = await supabase.rpc(
    "join_coaching_via_invite_code",
    { p_invite_code: code },
  );

  if (rpcError) {
    return { error: `خطا در اتصال مربی: ${rpcError.message}` };
  }

  if (result?.error) {
    return { error: result.error };
  }

  revalidatePath("/community");

  return { success: true, message: "مربی با موفقیت اضافه شد" };
}

export async function joinClubByInviteAction(
  _prevState: CommunityActionState,
  formData: FormData,
): Promise<CommunityActionState> {
  const rawCode = formData.get("club_invite_code");
  const inviteCode = normalizeCode(String(rawCode ?? ""));

  if (!inviteCode) {
    return { error: "کد دعوت کلاب را وارد کنید" };
  }

  const { supabase, user } = await getCurrentUserAndRole();

  if (!user) {
    return { error: "برای این عملیات باید وارد حساب شوید" };
  }

  const { data: result, error: rpcError } = await supabase.rpc(
    "join_club_via_invite_code",
    { p_invite_code: inviteCode },
  );

  if (rpcError) {
    return { error: `خطا در عضویت کلاب: ${rpcError.message}` };
  }

  if (result?.error) {
    return { error: result.error };
  }

  revalidatePath("/community");

  return { success: true, message: "با موفقیت به کلاب پیوستید" };
}

export async function createClubAction(
  _prevState: CommunityActionState,
  formData: FormData,
): Promise<CommunityActionState> {
  const rawName = String(formData.get("club_name") ?? "").trim();
  const rawDescription = String(formData.get("club_description") ?? "").trim();

  if (!rawName) {
    return { error: "نام کلاب را وارد کنید" };
  }

  if (rawName.length < 3) {
    return { error: "نام کلاب باید حداقل ۳ کاراکتر باشد" };
  }

  const { supabase, user } = await getCurrentUserAndRole();

  if (!user) {
    return { error: "برای این عملیات باید وارد حساب شوید" };
  }

  // Try up to 5 times to create a club with a unique invite code
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const inviteCode = normalizeCode(`CLUB-${randomChunk(6)}`);

    const { data: result, error: rpcError } = await supabase.rpc(
      "create_club_with_owner",
      {
        p_club_name: rawName,
        p_club_description: rawDescription,
        p_invite_code: inviteCode,
      },
    );

    if (rpcError) {
      return { error: `خطا در ساخت کلاب: ${rpcError.message}` };
    }

    if (result?.error) {
      // If it's an invite code conflict, retry with a new code
      if (result.error.includes("Invite code already exists")) {
        continue;
      }
      return { error: result.error };
    }

    // Success!
    revalidatePath("/community");

    return {
      success: true,
      message: `کلاب ساخته شد. کد دعوت: ${result.invite_code}`,
    };
  }

  return { error: "در ساخت کد دعوت یکتا برای کلاب خطا رخ داد" };
}

export async function setPrimaryClubAction(
  _prevState: CommunityActionState,
  formData: FormData,
): Promise<CommunityActionState> {
  const clubId = String(formData.get("club_id") ?? "").trim();

  if (!clubId) {
    return { error: "کلاب معتبر نیست" };
  }

  const { supabase, user } = await getCurrentUserAndRole();

  if (!user) {
    return { error: "برای این عملیات باید وارد حساب شوید" };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("club_members")
    .select("id")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError || !membership?.id) {
    return { error: "شما عضو این کلاب نیستید" };
  }

  const { error: resetError } = await supabase
    .from("club_members")
    .update({ is_primary: false })
    .eq("user_id", user.id)
    .eq("is_primary", true);

  if (resetError) {
    return { error: `خطا در تنظیم کلاب اصلی: ${resetError.message}` };
  }

  const { error: setError } = await supabase
    .from("club_members")
    .update({ is_primary: true })
    .eq("club_id", clubId)
    .eq("user_id", user.id);

  if (setError) {
    return { error: `خطا در تنظیم کلاب اصلی: ${setError.message}` };
  }

  revalidatePath("/community");

  return { success: true, message: "کلاب اصلی شما به‌روزرسانی شد" };
}

export async function leaveClubAction(
  _prevState: CommunityActionState,
  formData: FormData,
): Promise<CommunityActionState> {
  const clubId = String(formData.get("club_id") ?? "").trim();

  if (!clubId) {
    return { error: "کلاب معتبر نیست" };
  }

  const { supabase, user } = await getCurrentUserAndRole();

  if (!user) {
    return { error: "برای این عملیات باید وارد حساب شوید" };
  }

  const { data: currentMembership } = await supabase
    .from("club_members")
    .select("id, is_primary")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!currentMembership?.id) {
    return { error: "شما عضو این کلاب نیستید" };
  }

  const { error: deleteError } = await supabase
    .from("club_members")
    .delete()
    .eq("club_id", clubId)
    .eq("user_id", user.id);

  if (deleteError) {
    return { error: `خطا در خروج از کلاب: ${deleteError.message}` };
  }

  if (currentMembership.is_primary) {
    const { data: nextMembership } = await supabase
      .from("club_members")
      .select("club_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (nextMembership?.club_id) {
      await supabase
        .from("club_members")
        .update({ is_primary: true })
        .eq("club_id", nextMembership.club_id)
        .eq("user_id", user.id);
    }
  }

  revalidatePath("/community");

  return { success: true, message: "از کلاب خارج شدید" };
}

export async function assignCoachWeeklyPlanAction(
  _prevState: CommunityActionState,
  formData: FormData,
): Promise<CommunityActionState> {
  const studentId = String(formData.get("student_id") ?? "").trim();

  if (!studentId) {
    return { error: "شاگرد معتبر نیست" };
  }

  const { supabase, user, role } = await getCurrentUserAndRole();

  if (!user) {
    return { error: "برای این عملیات باید وارد حساب شوید" };
  }

  if (!COACH_ENABLED_ROLES.has(role ?? "")) {
    return { error: "نقش فعلی شما اجازه ارسال برنامه به شاگرد را ندارد" };
  }

  // Use the atomic RPC function that handles everything in a transaction
  const { data: result, error: rpcError } = await supabase.rpc(
    "assign_coach_schedule_to_student",
    { p_student_id: studentId },
  );

  if (rpcError) {
    return {
      error: `خطا در جایگزینی برنامه شاگرد: ${rpcError.message}`,
    };
  }

  if (result?.error) {
    return { error: result.error };
  }

  revalidatePath("/community");
  revalidatePath("/dashboard");

  return {
    success: true,
    message: "برنامه هفتگی شما برای شاگرد جایگزین شد",
  };
}

export async function followUserAction(
  _prevState: CommunityActionState,
  formData: FormData,
): Promise<CommunityActionState> {
  const followingId = String(formData.get("following_id") ?? "").trim();

  if (!followingId) {
    return { error: "کاربر معتبر نیست" };
  }

  const { supabase, user } = await getCurrentUserAndRole();

  if (!user) {
    return { error: "برای این عملیات باید وارد حساب شوید" };
  }

  if (followingId === user.id) {
    return { error: "نمی‌توانید خودتان را فالو کنید" };
  }

  const { error } = await supabase.from("social_graph").insert({
    follower_id: user.id,
    following_id: followingId,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "این کاربر قبلاً فالو شده است" };
    }

    return { error: `خطا در فالو کردن: ${error.message}` };
  }

  revalidatePath("/community");

  return { success: true, message: "کاربر با موفقیت فالو شد" };
}

export async function unfollowUserAction(
  _prevState: CommunityActionState,
  formData: FormData,
): Promise<CommunityActionState> {
  const followingId = String(formData.get("following_id") ?? "").trim();

  if (!followingId) {
    return { error: "کاربر معتبر نیست" };
  }

  const { supabase, user } = await getCurrentUserAndRole();

  if (!user) {
    return { error: "برای این عملیات باید وارد حساب شوید" };
  }

  const { error } = await supabase
    .from("social_graph")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", followingId);

  if (error) {
    return { error: `خطا در آنفالو کردن: ${error.message}` };
  }

  revalidatePath("/community");

  return { success: true, message: "کاربر آنفالو شد" };
}
