import type { Metadata } from "next";
import { redirectIfSignedIn } from "@/app/lib/me-data";
import { AuthHeading } from "../components/auth-heading";
import { AuthLink } from "../components/auth-link";
import { AuthShell } from "../components/auth-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · CoachIn" };

export default async function LoginPage() {
  await redirectIfSignedIn();
  return (
    <AuthShell>
      <div className='flex flex-col gap-6'>
        <AuthHeading title='Welcome back' subtitle='Your streak missed you.' />
        <LoginForm />
        <AuthLink href='/auth/forgot-password'>Forgot your password?</AuthLink>
        <AuthLink prompt='New here?' href='/auth/register'>
          Create an account
        </AuthLink>
      </div>
    </AuthShell>
  );
}
