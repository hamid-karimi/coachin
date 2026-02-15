"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { registerAction, type RegisterState } from "./actions";
import { SubmitButton } from "../components/submit-button";
import { AuthContainer } from "../components/auth-container";
import Link from "next/link";
import { useActionToast } from "@/components/hooks/use-action-toast";

const initialState: RegisterState = {};

export default function RegisterPage() {
  const router = useRouter();
  const [state, formAction] = useActionState(registerAction, initialState);
  useActionToast(state);

  useEffect(() => {
    if (state.redirect) {
      router.push(state.redirect);
    }
  }, [state.redirect, router]);

  return (
    <AuthContainer>
      <div className='w-full max-w-md p-8'>
        <div className='bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8'>
          <div className='text-center mb-8'>
            <h1 className='text-3xl font-bold text-slate-900 dark:text-white'>
              Create Account
            </h1>
            <p className='text-slate-600 dark:text-slate-400 mt-2'>
              Join us to start your journey
            </p>
          </div>

          <form action={formAction} className='space-y-6'>
            <div>
              <label
                htmlFor='fullName'
                className='block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2'>
                Full Name
              </label>
              <input
                id='fullName'
                name='fullName'
                type='text'
                autoComplete='name'
                required
                className='w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition'
                placeholder='John Doe'
              />
            </div>

            <div>
              <label
                htmlFor='email'
                className='block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2'>
                Email
              </label>
              <input
                id='email'
                name='email'
                type='email'
                autoComplete='email'
                required
                className='w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition'
                placeholder='you@example.com'
              />
            </div>

            <div>
              <label
                htmlFor='password'
                className='block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2'>
                Password
              </label>
              <input
                id='password'
                name='password'
                type='password'
                autoComplete='new-password'
                required
                className='w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition'
                placeholder='••••••••'
                aria-describedby='password-requirements'
              />
              <p
                id='password-requirements'
                className='mt-2 text-xs text-slate-500 dark:text-slate-400'>
                At least 8 characters with uppercase, lowercase, and number
              </p>
            </div>

            <div>
              <label
                htmlFor='confirmPassword'
                className='block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2'>
                Confirm Password
              </label>
              <input
                id='confirmPassword'
                name='confirmPassword'
                type='password'
                autoComplete='new-password'
                required
                className='w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition'
                placeholder='••••••••'
              />
            </div>

            <SubmitButton pendingText='Creating account...'>
              Create Account
            </SubmitButton>
          </form>

          <div className='mt-6 text-center'>
            <p className='text-sm text-slate-600 dark:text-slate-400'>
              Already have an account?{" "}
              <Link
                href='/auth/login'
                className='font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition'>
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </AuthContainer>
  );
}
