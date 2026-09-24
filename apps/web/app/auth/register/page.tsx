import type { Metadata } from "next";
import { redirectIfSignedIn } from "@/app/lib/me-data";
import { AuthHeading } from "../components/auth-heading";
import { AuthLink } from "../components/auth-link";
import { AuthShell } from "../components/auth-shell";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create account · CoachIn" };

export default async function RegisterPage() {
  await redirectIfSignedIn();
  return (
    <AuthShell>
      <div className='flex flex-col gap-6'>
        <AuthHeading title='Create account' subtitle='Free forever. Level 1 starts today.' />
        <RegisterForm />
        <AuthLink prompt='Already have an account?' href='/auth/login'>
          Sign in
        </AuthLink>
      </div>
    </AuthShell>
  );
}
