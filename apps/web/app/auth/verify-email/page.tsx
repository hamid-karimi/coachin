import type { Metadata } from "next";
import { connection } from "next/server";
import { serverApi } from "@/lib/api/server";
import { problemMessage } from "@/lib/api/problem";
import { AuthHeading } from "../components/auth-heading";
import { AuthLink } from "../components/auth-link";
import { AuthShell } from "../components/auth-shell";
import { FormAlert } from "../components/form-alert";

export const metadata: Metadata = { title: "Confirm email · CoachIn" };

type Outcome = { ok: boolean; message: string };

async function verify(token: string | undefined): Promise<Outcome> {
  if (!token) return { ok: false, message: "This link is invalid or has expired" };
  const api = await serverApi();
  const { data, error } = await api.POST("/auth/verify-email", { body: { token } });
  return data ? { ok: true, message: data.message } : { ok: false, message: problemMessage(error) };
}

/** Opening the emailed link confirms the address on the server. */
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  await connection();
  const { token } = await searchParams;
  const outcome = await verify(typeof token === "string" ? token : undefined);
  return (
    <AuthShell>
      <div className='flex flex-col gap-6'>
        <AuthHeading title='Email confirmation' subtitle='One tap and you are set.' />
        <FormAlert tone={outcome.ok ? "success" : "error"}>{outcome.message}</FormAlert>
        <AuthLink href='/'>Continue to CoachIn</AuthLink>
      </div>
    </AuthShell>
  );
}
