import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const TONES = {
  error: { icon: CircleAlert, className: "text-destructive", role: "alert" },
  success: { icon: CircleCheck, className: "text-success", role: "status" },
  info: { icon: Info, className: "text-muted-foreground", role: "status" },
} as const;

interface FormAlertProps {
  tone: keyof typeof TONES;
  id?: string;
  children: React.ReactNode;
}

/** A one-line message under a field or at the end of a form. */
export function FormAlert({ tone, id, children }: FormAlertProps) {
  const { icon: Icon, className, role } = TONES[tone];
  return (
    <p id={id} role={role} aria-live='polite' className={cn("flex items-center gap-1.5 text-sm", className)}>
      <Icon className='size-3.5 shrink-0' aria-hidden />
      {children}
    </p>
  );
}
