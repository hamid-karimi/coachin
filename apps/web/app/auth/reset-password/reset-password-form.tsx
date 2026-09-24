"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { $api } from "@/lib/api/browser";
import { problemMessage } from "@/lib/api/problem";
import { resetPasswordSchema, type ResetPasswordValues } from "@/lib/auth-schemas";
import { AuthLink } from "../components/auth-link";
import { FormAlert } from "../components/form-alert";
import { NewPasswordFields } from "../components/new-password-fields";
import { SubmitButton } from "../components/submit-button";

export function ResetPasswordForm({ token }: { token: string }) {
  const form = useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: "" } });
  const password = useWatch({ control: form.control, name: "password" });
  const reset = $api.useMutation("post", "/auth/password/reset", {
    onError: (error) => form.setError("root", { message: problemMessage(error) }),
  });
  const { errors } = form.formState;

  if (reset.isSuccess) {
    return (
      <div className='space-y-4'>
        <FormAlert tone='success'>{reset.data.message}</FormAlert>
        <AuthLink href='/auth/login'>Sign in</AuthLink>
      </div>
    );
  }

  return (
    <form
      onSubmit={form.handleSubmit((values) => reset.mutate({ body: { token, ...values } }))}
      className='space-y-5'
      noValidate>
      <NewPasswordFields
        label='New password'
        password={password ?? ""}
        passwordRegistration={form.register("password")}
        confirmRegistration={form.register("confirmPassword")}
        passwordError={errors.password?.message}
        confirmError={errors.confirmPassword?.message}
      />
      {errors.root && <FormAlert tone='error'>{errors.root.message}</FormAlert>}
      <SubmitButton pending={reset.isPending} pendingText='Saving…'>
        Set new password
      </SubmitButton>
    </form>
  );
}
