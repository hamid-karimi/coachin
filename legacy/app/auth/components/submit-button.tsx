"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SubmitButtonProps {
  pendingText?: string;
  children: React.ReactNode;
}

export function SubmitButton({
  pendingText = "Submitting...",
  children,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="brand"
      disabled={pending}
      className="w-full"
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {pendingText}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
