"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";
import { SubmitButton } from "../components/submit-button";
import { AuthContainer } from "../components/auth-container";
import Link from "next/link";
import { useActionToast } from "@/components/hooks/use-action-toast";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction] = useActionState(loginAction, initialState);
  useActionToast(state);

  return (
    <AuthContainer>
      <div className='w-full max-w-md p-8'>
        <div className='bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8'>
          <div className='text-center mb-8'>
            <h1 className='text-3xl font-bold text-slate-900 dark:text-white'>
              Welcome Back
            </h1>
            <p className='text-slate-600 dark:text-slate-400 mt-2'>
              Sign in to your account
            </p>
          </div>

          <form action={formAction} className='space-y-6'>
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
                autoComplete='current-password'
                required
                className='w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition'
                placeholder='••••••••'
              />
            </div>

            <SubmitButton pendingText='Signing in...'>Sign In</SubmitButton>
          </form>

          <div className='mt-6 text-center'>
            <p className='text-sm text-slate-600 dark:text-slate-400'>
              Dont have an account?{" "}
              <Link
                href='/auth/register'
                className='font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition'>
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </AuthContainer>
  );
}
