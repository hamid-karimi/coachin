"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerAction, type RegisterState } from "./actions";
import { SubmitButton } from "../components/submit-button";
import { AuthShell } from "../components/auth-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/components/hooks/use-action-toast";
import { cn } from "@/lib/utils";

const initialState: RegisterState = {};

export default function RegisterPage() {
  const router = useRouter();
  const [state, formAction] = useActionState(registerAction, initialState);
  useActionToast(state);

  useEffect(() => {
    if (state.redirect) {
      router.push(state.redirect);
    }
  }, [state.redirect, router]);

  return (
    <AuthShell>
      <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Create account</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Join CoachIn to start your journey.
          </p>
        </div>

        {/* Segmented Log in / Sign up control */}
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1">
          <Link
            href="/auth/login"
            className={cn(
              "rounded-md py-2 text-center text-sm font-medium transition-colors",
              "text-muted-foreground hover:text-foreground",
            )}
          >
            Log in
          </Link>
          <Link
            href="/auth/register"
            aria-current="page"
            className={cn(
              "rounded-md py-2 text-center text-sm font-medium transition-colors",
              "bg-card text-foreground shadow-sm",
            )}
          >
            Sign up
          </Link>
        </div>

        <form action={formAction} className="space-y-5">
          {state.error && (
            <div id="register-error" role="alert" aria-live="polite" className="sr-only">
              {state.error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              name="fullName"
              type="text"
              autoComplete="name"
              required
              aria-describedby={state.error ? "register-error" : undefined}
              placeholder="John Doe"
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
              aria-describedby={state.error ? "register-error" : undefined}
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
              aria-describedby={
                state.error
                  ? "register-error password-requirements"
                  : "password-requirements"
              }
              placeholder="••••••••"
            />
            <p
              id="password-requirements"
              className="text-xs text-muted-foreground"
            >
              At least 8 characters with uppercase, lowercase, and number
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              aria-describedby={state.error ? "register-error" : undefined}
              placeholder="••••••••"
            />
          </div>

          <SubmitButton pendingText="Creating account...">
            Create account
          </SubmitButton>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className="font-medium text-brand-ink hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
