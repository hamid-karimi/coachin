"use client";

import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { $api } from "@/lib/api/browser";
import { problemMessage } from "@/lib/api/problem";
import { registerSchema, type RegisterValues } from "@/lib/auth-schemas";
import { FormAlert } from "../components/form-alert";
import { FormField } from "../components/form-field";
import { NewPasswordFields } from "../components/new-password-fields";
import { SubmitButton } from "../components/submit-button";

export function RegisterForm() {
  const router = useRouter();
  const form = useForm<RegisterValues>({ resolver: zodResolver(registerSchema), defaultValues: { password: "" } });
  const password = useWatch({ control: form.control, name: "password" });
  const register = $api.useMutation("post", "/auth/register", {
    // Signed in straight away; the confirmation email doesn't block anything.
    onSuccess: () => {
      router.replace("/");
      router.refresh();
    },
    onError: (error) => form.setError("root", { message: problemMessage(error) }),
  });
  const { errors } = form.formState;

  return (
    <form onSubmit={form.handleSubmit((body) => register.mutate({ body }))} className='space-y-5' noValidate>
      <FormField
        id='fullName'
        label='Full name'
        autoComplete='name'
        placeholder='Maya Kim'
        error={errors.fullName?.message}
        registration={form.register("fullName")}
      />
      <FormField
        id='email'
        label='Email'
        type='email'
        autoComplete='email'
        placeholder='you@example.com'
        error={errors.email?.message}
        registration={form.register("email")}
      />
      <NewPasswordFields
        password={password ?? ""}
        passwordRegistration={form.register("password")}
        confirmRegistration={form.register("confirmPassword")}
        passwordError={errors.password?.message}
        confirmError={errors.confirmPassword?.message}
      />
      {errors.root && <FormAlert tone='error'>{errors.root.message}</FormAlert>}
      <SubmitButton pending={register.isPending} pendingText='Creating account…'>
        Create account
      </SubmitButton>
    </form>
  );
}
