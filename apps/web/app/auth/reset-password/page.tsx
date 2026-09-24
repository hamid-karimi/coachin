import type { Metadata } from "next";
import { AuthHeading } from "../components/auth-heading";
import { AuthLink } from "../components/auth-link";
import { AuthShell } from "../components/auth-shell";
import { FormAlert } from "../components/form-alert";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Choose a new password · CoachIn" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  return (
    <AuthShell>
      <div className='flex flex-col gap-6'>
        <AuthHeading title='Choose a new password' subtitle='Pick something you have not used here before.' />
        {typeof token === "string" && token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <>
            <FormAlert tone='error'>This link is invalid or has expired</FormAlert>
            <AuthLink href='/auth/forgot-password'>Request a new link</AuthLink>
          </>
        )}
      </div>
    </AuthShell>
  );
}
