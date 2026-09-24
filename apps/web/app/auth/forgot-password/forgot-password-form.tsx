"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { $api } from "@/lib/api/browser";
import { problemMessage } from "@/lib/api/problem";
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/lib/auth-schemas";
import { FormAlert } from "../components/form-alert";
import { FormField } from "../components/form-field";
import { SubmitButton } from "../components/submit-button";

export function ForgotPasswordForm() {
  const form = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema) });
  const forgot = $api.useMutation("post", "/auth/password/forgot", {
    onError: (error) => form.setError("root", { message: problemMessage(error) }),
  });
  const { errors } = form.formState;

  // The API answers the same whether or not the address has an account.
  if (forgot.isSuccess) {
    return <FormAlert tone='info'>{forgot.data.message}</FormAlert>;
  }

  return (
    <form onSubmit={form.handleSubmit((body) => forgot.mutate({ body }))} className='space-y-5' noValidate>
      <FormField
        id='email'
        label='Email'
        type='email'
        autoComplete='email'
        placeholder='you@example.com'
        error={errors.email?.message}
        registration={form.register("email")}
      />
      {errors.root && <FormAlert tone='error'>{errors.root.message}</FormAlert>}
      <SubmitButton pending={forgot.isPending} pendingText='Sending…'>
        Email me a reset link
      </SubmitButton>
    </form>
  );
}
