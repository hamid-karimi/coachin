"use server";

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
    output += alphabet[Math.floor(Math.random() * alphabet.length)];
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

  const { data: invite, error: inviteError } = await supabase
    .from("coach_invite_codes")
    .select("coach_id, sport_type_id, is_active, expires_at")
    .eq("code", code)
    .single();

  if (inviteError || !invite) {
    return { error: "کد دعوت معتبر نیست" };
  }

  if (!invite.is_active) {
    return { error: "این کد دعوت غیرفعال شده است" };
  }

  if (invite.expires_at && new Date(invite.expires_at) <= new Date()) {
    return { error: "اعتبار این کد دعوت تمام شده است" };
  }

  if (invite.coach_id === user.id) {
    return { error: "نمی‌توانید خودتان را به‌عنوان مربی اضافه کنید" };
  }

  const { error: relationError } = await supabase
    .from("coaching_relationships")
    .insert({
      coach_id: invite.coach_id,
      student_id: user.id,
      sport_type_id: invite.sport_type_id,
      status: "active",
    });

  if (relationError) {
    if (relationError.code === "23505") {
      return { error: "این رابطه مربیگری از قبل ثبت شده است" };
    }

    return { error: `خطا در اتصال مربی: ${relationError.message}` };
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

  const { data: club, error: clubError } = await supabase
    .from("clubs")
    .select("id")
    .eq("invite_code", inviteCode)
    .single();

  if (clubError || !club?.id) {
    return { error: "کد دعوت کلاب معتبر نیست" };
  }

  const { data: existingPrimary } = await supabase
    .from("club_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_primary", true)
    .maybeSingle();

  const { error: insertError } = await supabase.from("club_members").insert({
    club_id: club.id,
    user_id: user.id,
    role: "member",
    is_primary: !existingPrimary,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return { error: "شما قبلاً عضو این کلاب شده‌اید" };
    }

    return { error: `خطا در عضویت کلاب: ${insertError.message}` };
  }

  revalidatePath("/community");

  return { success: true, message: "با موفقیت به کلاب پیوستید" };
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
