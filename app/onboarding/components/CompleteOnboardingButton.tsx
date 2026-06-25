import { Button } from "@/components/ui/button";

interface CompleteOnboardingButtonProps {
  onSubmit: (formData: FormData) => void;
  isPending?: boolean;
}

export function CompleteOnboardingButton({
  onSubmit,
  isPending = false,
}: CompleteOnboardingButtonProps) {
  return (
    <div className='border-t border-border pt-8'>
      <form action={onSubmit} className='flex justify-center'>
        <Button type='submit' variant='brand' size='lg' disabled={isPending}>
          {isPending ? "Processing..." : "Continue to dashboard"}
        </Button>
      </form>
    </div>
  );
}
