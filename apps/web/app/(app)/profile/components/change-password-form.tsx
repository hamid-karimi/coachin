"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormAlert } from "@/app/auth/components/form-alert";
import { FormField } from "@/app/auth/components/form-field";
import { NewPasswordFields } from "@/app/auth/components/new-password-fields";
import { SubmitButton } from "@/app/auth/components/submit-button";
import { $api } from "@/lib/api/browser";
import { problemMessage } from "@/lib/api/problem";
import { changePasswordSchema, type ChangePasswordValues } from "@/lib/auth-schemas";

const EMPTY: ChangePasswordValues = { currentPassword: "", password: "", confirmPassword: "" };

/** Keeps this browser signed in; the API ends every other session. */
export function ChangePasswordForm() {
  const form = useForm<ChangePasswordValues>({ resolver: zodResolver(changePasswordSchema), defaultValues: EMPTY });
  const password = useWatch({ control: form.control, name: "password" });
  const change = $api.useMutation("post", "/auth/password/change", {
    onSuccess: () => form.reset(EMPTY),
    onError: (error) => form.setError("root", { message: problemMessage(error) }),
  });
  const { errors } = form.formState;

  return (
    <form onSubmit={form.handleSubmit((body) => change.mutate({ body }))} className='space-y-5' noValidate>
      <FormField
        id='currentPassword'
        label='Current password'
        type='password'
        autoComplete='current-password'
        placeholder='••••••••'
        error={errors.currentPassword?.message}
        registration={form.register("currentPassword")}
      />
      <NewPasswordFields
        label='New password'
        password={password}
        passwordRegistration={form.register("password")}
        confirmRegistration={form.register("confirmPassword")}
        passwordError={errors.password?.message}
        confirmError={errors.confirmPassword?.message}
      />
      {errors.root && <FormAlert tone='error'>{errors.root.message}</FormAlert>}
      {change.isSuccess && !form.formState.isDirty && <FormAlert tone='success'>{change.data.message}</FormAlert>}
      <SubmitButton pending={change.isPending} pendingText='Saving…'>
        Change password
      </SubmitButton>
    </form>
  );
}
