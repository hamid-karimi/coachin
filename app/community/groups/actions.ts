"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { isCommunityEnabled } from "@/lib/feature-flags";

export type GroupsActionState = {
  error?: string;
  success?: boolean;
  message?: string;
  status?: "success" | "info" | "error";
};

// Server actions stay callable even when their UI is hidden, so the community
// kill-switch blocks group mutations here as well as in the layout.
const COMMUNITY_DISABLED: GroupsActionState = {
  error: "Community features are currently disabled.",
};

export async function createGroupAction(
  _prevState: GroupsActionState,
  formData: FormData,
): Promise<GroupsActionState> {
  if (!isCommunityEnabled()) return COMMUNITY_DISABLED;

  const user = await getUser();
  if (!user) return { error: "You must be signed in" };

  const name = String(formData.get("group_name") ?? "").trim();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_training_group", {
    p_name: name,
  });

  if (error || !data?.success) {
    return { error: data?.error ?? "Failed to create the group" };
  }

  revalidatePath("/community/groups", "layout");
  return {
    success: true,
    status: "success",
    message: `Group created — share code ${data.invite_code} with your friends.`,
  };
}

export async function joinGroupAction(
  _prevState: GroupsActionState,
  formData: FormData,
): Promise<GroupsActionState> {
  if (!isCommunityEnabled()) return COMMUNITY_DISABLED;

  const user = await getUser();
  if (!user) return { error: "You must be signed in" };

  const code = String(formData.get("group_invite_code") ?? "").trim();
  if (!code) return { error: "Enter an invite code" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_training_group", {
    p_invite_code: code,
  });

  if (error || !data?.success) {
    return { error: data?.error ?? "Failed to join the group" };
  }

  revalidatePath("/community/groups", "layout");
  if (data.status === "already_member") {
    return {
      success: true,
      status: "info",
      message: "You are already in this group.",
    };
  }
  return { success: true, status: "success", message: "Joined the group." };
}

export async function leaveGroupAction(
  _prevState: GroupsActionState,
  formData: FormData,
): Promise<GroupsActionState> {
  if (!isCommunityEnabled()) return COMMUNITY_DISABLED;

  const user = await getUser();
  if (!user) return { error: "You must be signed in" };

  const groupId = String(formData.get("group_id") ?? "").trim();
  if (!groupId) return { error: "Missing group id" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("leave_training_group", {
    p_group_id: groupId,
  });

  if (error || !data?.success) {
    return { error: data?.error ?? "Failed to leave the group" };
  }

  revalidatePath("/community/groups", "layout");
  return { success: true, status: "info", message: "You left the group." };
}
