"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Circle, CircleAlert } from "lucide-react";
import { registerAction, type RegisterState } from "./actions";
import { SubmitButton } from "../components/submit-button";
import { AuthShell } from "../components/auth-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/components/hooks/use-action-toast";
import { cn } from "@/lib/utils";

const initialState: RegisterState = {};

const RULES = [
  { key: "length", label: "8+ characters", test: (v: string) => v.length >= 8 },
  {
    key: "case",
    label: "Upper & lowercase",
    test: (v: string) => /[A-Z]/.test(v) && /[a-z]/.test(v),
  },
  { key: "number", label: "A number", test: (v: string) => /[0-9]/.test(v) },
] as const;

const BONUS_RULE = {
  label: "A symbol (optional, +1 strength)",
  test: (v: string) => /[^A-Za-z0-9]/.test(v),
};

export default function RegisterPage() {
  const router = useRouter();
  const [state, formAction] = useActionState(registerAction, initialState);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  // Success with email verification still surfaces via toast.
  useActionToast({ ...state, error: undefined });

  useEffect(() => {
    if (state.redirect) {
      router.push(state.redirect);
    }
  }, [state.redirect, router]);

  const passed = RULES.filter((rule) => rule.test(password)).length;
  const bonusPassed = BONUS_RULE.test(password);
  const strength = password ? passed + (bonusPassed ? 1 : 0) : 0;
  const mismatch = confirm.length > 0 && confirm !== password;

  return (
    <AuthShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-foreground font-display text-3xl font-bold tracking-tight">
            Create account
          </h1>
          <p className="text-muted-foreground mt-1.5">
            Free forever. Level 1 starts today.
          </p>
        </div>

        <form action={formAction} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              name="fullName"
              type="text"
              autoComplete="name"
              required
              placeholder="Maya Kim"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby="password-requirements"
              placeholder="••••••••"
            />
            {/* strength segments */}
            <div className="flex gap-1" aria-hidden>
              {[0, 1, 2, 3].map((index) => (
                <span
                  key={index}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    index < strength ? "bg-success" : "bg-border",
                  )}
                />
              ))}
            </div>
            <ul
              id="password-requirements"
              className="space-y-0.5 text-xs"
              aria-live="polite"
            >
              {RULES.map((rule) => {
                const ok = rule.test(password);
                return (
                  <li
                    key={rule.key}
                    className={cn(
                      "flex items-center gap-1.5",
                      ok ? "text-success" : "text-muted-foreground",
                    )}
                  >
                    {ok ? (
                      <Check className="size-3" aria-hidden />
                    ) : (
                      <Circle className="size-3" aria-hidden />
                    )}
                    {rule.label}
                  </li>
                );
              })}
              <li
                className={cn(
                  "flex items-center gap-1.5",
                  bonusPassed ? "text-success" : "text-muted-foreground/70",
                )}
              >
                {bonusPassed ? (
                  <Check className="size-3" aria-hidden />
                ) : (
                  <Circle className="size-3" aria-hidden />
                )}
                {BONUS_RULE.label}
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              aria-invalid={mismatch ? true : undefined}
              aria-describedby={mismatch ? "confirm-error" : undefined}
              placeholder="Repeat password"
            />
            {mismatch && (
              <p id="confirm-error" className="text-destructive text-[13px]">
                Passwords don&apos;t match
              </p>
            )}
          </div>

          {state.error && (
            <p
              role="alert"
              aria-live="polite"
              className="text-destructive flex items-center gap-1.5 text-[13px]"
            >
              <CircleAlert className="size-3.5 shrink-0" aria-hidden />
              {state.error}
            </p>
          )}

          <SubmitButton pendingText="Creating account…">
            Create account
          </SubmitButton>
        </form>

        <p className="text-muted-foreground text-center text-sm">
          Have an account?{" "}
          <Link
            href="/auth/login"
            className="text-brand-ink font-semibold hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
