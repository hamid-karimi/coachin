"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type LoginState = {
  error?: string;
  success?: boolean;
};

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  // Validation
  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Invalid email format" };
  }

  try {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: error.message };
    }

    if (!data.session) {
      return { error: "Failed to create session" };
    }

    // Revalidate the cache for the entire app
    // This ensures the auth state is updated everywhere
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "An error occurred",
    };
  }

  // Redirect after successful login
  // This must be outside the try-catch as redirect() throws
  redirect("/dashboard");
}
