import { z } from "zod";

/**
 * Client-side form rules for instant feedback. The API enforces the same
 * rules and is the authority; messages match it (and the legacy app) word for
 * word so a user sees the same text either way.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const email = z.string().trim().min(1, "Email is required").regex(EMAIL_PATTERN, "Invalid email format");

const newPassword = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .refine((value) => /[A-Z]/.test(value) && /[a-z]/.test(value) && /[0-9]/.test(value), {
    message: "Password must contain at least one uppercase letter, one lowercase letter, and one number",
  });

function confirmed<T extends z.ZodObject<{ password: z.ZodTypeAny; confirmPassword: z.ZodTypeAny }>>(schema: T) {
  return schema.refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
}

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = confirmed(
  z.object({
    fullName: z.string().trim().min(1, "Full name is required"),
    email,
    password: newPassword,
    confirmPassword: z.string(),
  }),
);

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = confirmed(
  z.object({
    password: newPassword,
    confirmPassword: z.string(),
  }),
);

export const changePasswordSchema = confirmed(
  z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    password: newPassword,
    confirmPassword: z.string(),
  }),
);

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
