"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { $api } from "@/lib/api/browser";
import { problemMessage } from "@/lib/api/problem";
import { loginSchema, type LoginValues } from "@/lib/auth-schemas";
import { FormAlert } from "../components/form-alert";
import { FormField } from "../components/form-field";
import { SubmitButton } from "../components/submit-button";

export function LoginForm() {
  const router = useRouter();
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const login = $api.useMutation("post", "/auth/login", {
    onSuccess: () => {
      router.replace("/");
      router.refresh();
    },
    onError: (error) => form.setError("root", { message: problemMessage(error) }),
  });
  const { errors } = form.formState;

  return (
    <form onSubmit={form.handleSubmit((body) => login.mutate({ body }))} className='space-y-5' noValidate>
      <FormField
        id='email'
        label='Email'
        type='email'
        autoComplete='email'
        placeholder='you@example.com'
        error={errors.email?.message}
        registration={form.register("email")}
      />
      <FormField
        id='password'
        label='Password'
        type='password'
        autoComplete='current-password'
        placeholder='••••••••'
        error={errors.password?.message}
        registration={form.register("password")}
      />
      {errors.root && <FormAlert tone='error'>{errors.root.message}</FormAlert>}
      <SubmitButton pending={login.isPending} pendingText='Signing in…'>
        Sign in
      </SubmitButton>
    </form>
  );
}
