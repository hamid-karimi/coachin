import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SubmitButtonProps {
  pending: boolean;
  pendingText: string;
  children: React.ReactNode;
}

export function SubmitButton({ pending, pendingText, children }: SubmitButtonProps) {
  return (
    <Button type='submit' variant='brand' disabled={pending} className='w-full'>
      {pending ? (
        <>
          <Loader2 className='size-4 animate-spin' aria-hidden />
          {pendingText}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
