"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type RegisterState = {
  error?: string;
  success?: boolean;
};

export async function registerAction(
  _prevState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;
  const fullName = formData.get("fullName") as string;

  // Validation
  if (!email || !password || !confirmPassword || !fullName) {
    return { error: "All fields are required" };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Invalid email format" };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  // Password strength validation
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (!hasUpperCase || !hasLowerCase || !hasNumber) {
    return {
      error:
        "Password must contain at least one uppercase letter, one lowercase letter, and one number",
    };
  }

  try {
    const supabase = await createClient();

    // Create the user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      return { error: error.message };
    }

    if (!data.user) {
      return { error: "Failed to create account" };
    }

    // If email confirmation is disabled, user will be logged in automatically
    // If email confirmation is enabled, user needs to verify email
    if (data.session) {
      // User is automatically logged in
      redirect("/dashboard");
    } else {
      // User needs to verify email
      return {
        success: true,
        error: "Please check your email to verify your account",
      };
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "An error occurred",
    };
  }
}
