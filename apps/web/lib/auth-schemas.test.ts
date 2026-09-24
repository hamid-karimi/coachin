import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema, resetPasswordSchema } from "./auth-schemas";

function firstError(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.success ? null : result.error?.issues[0]?.message;
}

describe("auth form schemas", () => {
  it("accepts a valid registration", () => {
    const result = registerSchema.safeParse({
      fullName: "Ada",
      email: "ada@example.com",
      password: "Lovelace1",
      confirmPassword: "Lovelace1",
    });
    expect(result.success).toBe(true);
  });

  it.each([
    [{ email: "ada@example", password: "Lovelace1" }, "Invalid email format"],
    [{ email: "ada@example.com", password: "short1A" }, "Password must be at least 8 characters"],
    [
      { email: "ada@example.com", password: "lowercase1" },
      "Password must contain at least one uppercase letter, one lowercase letter, and one number",
    ],
  ])("uses the legacy messages (%j)", (fields, message) => {
    const result = registerSchema.safeParse({ fullName: "Ada", confirmPassword: fields.password, ...fields });
    expect(firstError(result)).toBe(message);
  });

  it("flags a mismatched confirmation on the confirm field", () => {
    const result = resetPasswordSchema.safeParse({ password: "Lovelace1", confirmPassword: "Lovelace2" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({ message: "Passwords do not match", path: ["confirmPassword"] });
  });

  it("only requires a password to sign in", () => {
    expect(loginSchema.safeParse({ email: "ada@example.com", password: "x" }).success).toBe(true);
    expect(firstError(loginSchema.safeParse({ email: "ada@example.com", password: "" }))).toBe("Password is required");
  });
});
