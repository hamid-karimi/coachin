"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type LoginState } from "./actions";
import { SubmitButton } from "../components/submit-button";
import { AuthShell } from "../components/auth-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/components/hooks/use-action-toast";
import { cn } from "@/lib/utils";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction] = useActionState(loginAction, initialState);
  useActionToast(state);

  return (
    <AuthShell>
      <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Sign in to continue your training.
          </p>
        </div>

        {/* Segmented Log in / Sign up control */}
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1">
          <Link
            href="/auth/login"
            aria-current="page"
            className={cn(
              "rounded-md py-2 text-center text-sm font-medium transition-colors",
              "bg-card text-foreground shadow-sm",
            )}
          >
            Log in
          </Link>
          <Link
            href="/auth/register"
            className={cn(
              "rounded-md py-2 text-center text-sm font-medium transition-colors",
              "text-muted-foreground hover:text-foreground",
            )}
          >
            Sign up
          </Link>
        </div>

        <form action={formAction} className="space-y-5">
          {state.error && (
            <div id="login-error" role="alert" aria-live="polite" className="sr-only">
              {state.error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
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
              aria-describedby={state.error ? "login-error" : undefined}
              placeholder="••••••••"
            />
          </div>

          <SubmitButton pendingText="Signing in...">Sign in</SubmitButton>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href="/auth/register"
            className="font-medium text-brand-ink hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
