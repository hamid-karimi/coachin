"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { loginAction, type LoginState } from "./actions";
import { SubmitButton } from "../components/submit-button";
import { AuthShell } from "../components/auth-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <AuthShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-foreground font-display text-3xl font-bold tracking-tight">
            Welcome back
          </h1>
          <p className="text-muted-foreground mt-1.5">
            Your streak missed you.
          </p>
        </div>

        <form action={formAction} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              aria-invalid={state.error ? true : undefined}
              aria-describedby={state.error ? "login-error" : undefined}
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              aria-invalid={state.error ? true : undefined}
              aria-describedby={state.error ? "login-error" : undefined}
              placeholder="••••••••"
            />
            {state.error && (
              <p
                id="login-error"
                role="alert"
                aria-live="polite"
                className="text-destructive flex items-center gap-1.5 text-[13px]"
              >
                <CircleAlert className="size-3.5 shrink-0" aria-hidden />
                {state.error}
              </p>
            )}
          </div>

          <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
        </form>

        <p className="text-muted-foreground text-center text-sm">
          New here?{" "}
          <Link
            href="/auth/register"
            className="text-brand-ink font-semibold hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
