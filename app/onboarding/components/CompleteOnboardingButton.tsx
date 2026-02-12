import { Message } from "./Message";

interface CompleteOnboardingButtonProps {
  onSubmit: (formData: FormData) => void;
  isPending?: boolean;
  error?: string;
}

export function CompleteOnboardingButton({
  onSubmit,
  isPending = false,
  error,
}: CompleteOnboardingButtonProps) {
  return (
    <div className='border-t border-slate-200 dark:border-slate-700 pt-8'>
      {error && (
        <div className='mb-4'>
          <Message type='error' message={error} />
        </div>
      )}
      <form action={onSubmit} className='flex justify-center'>
        <button
          type='submit'
          className='bg-green-600 text-white text-lg px-12 py-3 rounded-lg hover:bg-green-700 shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed'
          disabled={isPending}>
          {isPending ? "درحال پردازش..." : "تایید و ورود به داشبورد ✅"}
        </button>
      </form>
    </div>
  );
}
