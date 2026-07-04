"use server";

import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CommunityActionState = {
  error?: string;
  success?: boolean;
  message?: string;
  status?: "success" | "info" | "error";
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
    return { error: "Invalid sport type." };
  }

  const { supabase, user, role } = await getCurrentUserAndRole();

  if (!user) {
    return { error: "You must be signed in to do this." };
  }

  if (!COACH_ENABLED_ROLES.has(role ?? "")) {
    return { error: "Your current role cannot generate coach invite codes." };
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
    return { error: `Failed to generate invite code: ${error.message}` };
  }

  revalidatePath("/community");

  return {
    success: true,
    message: `New invite code generated: ${code}`,
    status: "success",
  };
}

export async function connectCoachByCodeAction(
  _prevState: CommunityActionState,
  formData: FormData,
): Promise<CommunityActionState> {
  const rawCode = formData.get("invite_code");
  const code = normalizeCode(String(rawCode ?? ""));

  if (!code) {
    return { error: "Please enter an invite code." };
  }

  const { supabase, user, role } = await getCurrentUserAndRole();

  if (!user) {
    return { error: "You must be signed in to do this." };
  }

  if (!STUDENT_ENABLED_ROLES.has(role ?? "")) {
    return { error: "Your current role cannot add a coach." };
  }

  const { data: result, error: rpcError } = await supabase.rpc(
    "join_coaching_via_invite_code",
    { p_invite_code: code },
  );

  if (rpcError) {
    return { error: `Failed to connect coach: ${rpcError.message}` };
  }

  if (result?.error) {
    return { error: result.error };
  }

  if (result?.status === "already_connected") {
    return {
      success: true,
      message: "You’re already connected to this coach.",
      status: "info",
    };
  }

  if (result?.status === "reactivated") {
    revalidatePath("/community");

    return {
      success: true,
      message: "Coach connection reactivated successfully.",
      status: "success",
    };
  }

  revalidatePath("/community");

  return {
    success: true,
    message: "Coach added successfully.",
    status: "success",
  };
}

export async function joinClubByInviteAction(
  _prevState: CommunityActionState,
  formData: FormData,
): Promise<CommunityActionState> {
  const rawCode = formData.get("club_invite_code");
  const inviteCode = normalizeCode(String(rawCode ?? ""));

  if (!inviteCode) {
    return { error: "Please enter a club invite code." };
  }

  const { supabase, user } = await getCurrentUserAndRole();

  if (!user) {
    return { error: "You must be signed in to do this." };
  }

  const { data: result, error: rpcError } = await supabase.rpc(
    "join_club_via_invite_code",
    { p_invite_code: inviteCode },
  );

  if (rpcError) {
    return { error: `Failed to join club: ${rpcError.message}` };
  }

  if (result?.error) {
    return { error: result.error };
  }

  revalidatePath("/community");

  return {
    success: true,
    message: "You joined the club successfully.",
    status: "success",
  };
}

export async function createClubAction(
  _prevState: CommunityActionState,
  formData: FormData,
): Promise<CommunityActionState> {
  const rawName = String(formData.get("club_name") ?? "").trim();
  const rawDescription = String(formData.get("club_description") ?? "").trim();

  if (!rawName) {
    return { error: "Please enter a club name." };
  }

  if (rawName.length < 3) {
    return { error: "Club name must be at least 3 characters." };
  }

  const { supabase, user } = await getCurrentUserAndRole();

  if (!user) {
    return { error: "You must be signed in to do this." };
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
      return { error: `Failed to create club: ${rpcError.message}` };
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
      message: `Club created. Invite code: ${result.invite_code}`,
      status: "success",
    };
  }

  return { error: "Failed to generate a unique club invite code." };
}

export async function setPrimaryClubAction(
  _prevState: CommunityActionState,
  formData: FormData,
): Promise<CommunityActionState> {
  const clubId = String(formData.get("club_id") ?? "").trim();

  if (!clubId) {
    return { error: "Invalid club." };
  }

  const { supabase, user } = await getCurrentUserAndRole();

  if (!user) {
    return { error: "You must be signed in to do this." };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("club_members")
    .select("id")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError || !membership?.id) {
    return { error: "You are not a member of this club." };
  }

  const { error: resetError } = await supabase
    .from("club_members")
    .update({ is_primary: false })
    .eq("user_id", user.id)
    .eq("is_primary", true);

  if (resetError) {
    return { error: `Failed to set primary club: ${resetError.message}` };
  }

  const { error: setError } = await supabase
    .from("club_members")
    .update({ is_primary: true })
    .eq("club_id", clubId)
    .eq("user_id", user.id);

  if (setError) {
    return { error: `Failed to set primary club: ${setError.message}` };
  }

  revalidatePath("/community");

  return {
    success: true,
    message: "Your primary club was updated.",
    status: "success",
  };
}

export async function leaveClubAction(
  _prevState: CommunityActionState,
  formData: FormData,
): Promise<CommunityActionState> {
  const clubId = String(formData.get("club_id") ?? "").trim();

  if (!clubId) {
    return { error: "Invalid club." };
  }

  const { supabase, user } = await getCurrentUserAndRole();

  if (!user) {
    return { error: "You must be signed in to do this." };
  }

  const { data: currentMembership } = await supabase
    .from("club_members")
    .select("id, is_primary")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!currentMembership?.id) {
    return { error: "You are not a member of this club." };
  }

  const { error: deleteError } = await supabase
    .from("club_members")
    .delete()
    .eq("club_id", clubId)
    .eq("user_id", user.id);

  if (deleteError) {
    return { error: `Failed to leave club: ${deleteError.message}` };
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

  return { success: true, message: "You left the club.", status: "success" };
}

export async function assignCoachWeeklyPlanAction(
  _prevState: CommunityActionState,
  formData: FormData,
): Promise<CommunityActionState> {
  const studentId = String(formData.get("student_id") ?? "").trim();

  if (!studentId) {
    return { error: "Invalid trainee." };
  }

  const { supabase, user, role } = await getCurrentUserAndRole();

  if (!user) {
    return { error: "You must be signed in to do this." };
  }

  if (!COACH_ENABLED_ROLES.has(role ?? "")) {
    return { error: "Your current role cannot assign plans to trainees." };
  }

  // Use the atomic RPC function that handles everything in a transaction
  const { data: result, error: rpcError } = await supabase.rpc(
    "assign_coach_schedule_to_student",
    { p_student_id: studentId },
  );

  if (rpcError) {
    return {
      error: `Failed to replace trainee schedule: ${rpcError.message}`,
    };
  }

  if (result?.error) {
    return { error: result.error };
  }

  revalidatePath("/community");
  revalidatePath("/dashboard");

  return {
    success: true,
    message: "Your weekly plan was assigned to the trainee.",
    status: "success",
  };
}

export async function followUserAction(
  _prevState: CommunityActionState,
  formData: FormData,
): Promise<CommunityActionState> {
  const followingId = String(formData.get("following_id") ?? "").trim();

  if (!followingId) {
    return { error: "Invalid user." };
  }

  const { supabase, user } = await getCurrentUserAndRole();

  if (!user) {
    return { error: "You must be signed in to do this." };
  }

  if (followingId === user.id) {
    return { error: "You cannot follow yourself." };
  }

  const { error } = await supabase.from("social_graph").insert({
    follower_id: user.id,
    following_id: followingId,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "You already follow this user." };
    }

    return { error: `Failed to follow user: ${error.message}` };
  }

  revalidatePath("/community");

  return { success: true, message: "User followed.", status: "success" };
}

export async function unfollowUserAction(
  _prevState: CommunityActionState,
  formData: FormData,
): Promise<CommunityActionState> {
  const followingId = String(formData.get("following_id") ?? "").trim();

  if (!followingId) {
    return { error: "Invalid user." };
  }

  const { supabase, user } = await getCurrentUserAndRole();

  if (!user) {
    return { error: "You must be signed in to do this." };
  }

  const { error } = await supabase
    .from("social_graph")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", followingId);

  if (error) {
    return { error: `Failed to unfollow user: ${error.message}` };
  }

  revalidatePath("/community");

  return { success: true, message: "User unfollowed.", status: "success" };
}
