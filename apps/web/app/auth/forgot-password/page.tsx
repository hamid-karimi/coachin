import type { Metadata } from "next";
import { redirectIfSignedIn } from "@/app/lib/me-data";
import { AuthHeading } from "../components/auth-heading";
import { AuthLink } from "../components/auth-link";
import { AuthShell } from "../components/auth-shell";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Reset password · CoachIn" };

export default async function ForgotPasswordPage() {
  await redirectIfSignedIn();
  return (
    <AuthShell>
      <div className='flex flex-col gap-6'>
        <AuthHeading title='Forgot your password?' subtitle="We'll email you a link to choose a new one." />
        <ForgotPasswordForm />
        <AuthLink href='/auth/login'>Back to sign in</AuthLink>
      </div>
    </AuthShell>
  );
}
