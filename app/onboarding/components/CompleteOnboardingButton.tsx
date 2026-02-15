interface CompleteOnboardingButtonProps {
  onSubmit: (formData: FormData) => void;
  isPending?: boolean;
}

export function CompleteOnboardingButton({
  onSubmit,
  isPending = false,
}: CompleteOnboardingButtonProps) {
  return (
    <div className='border-t border-slate-200 dark:border-slate-700 pt-8'>
      <form action={onSubmit} className='flex justify-center'>
        <button
          type='submit'
          className='bg-green-600 text-white text-lg px-12 py-3 rounded-lg hover:bg-green-700 shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed'
          disabled={isPending}>
          {isPending ? "Processing..." : "Finish and go to dashboard ✅"}
        </button>
      </form>
    </div>
  );
}
