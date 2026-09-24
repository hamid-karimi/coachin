import type { UseFormRegisterReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormAlert } from "./form-alert";

interface FormFieldProps {
  id: string;
  label: string;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  placeholder?: string;
  error?: string;
  registration: UseFormRegisterReturn;
  /** Extra content under the input (e.g. a strength meter). */
  children?: React.ReactNode;
  /** Id of that extra content, for aria-describedby. */
  describedBy?: string;
}

/** Label + input + its validation message, wired for screen readers. */
export function FormField({
  id,
  label,
  type = "text",
  autoComplete,
  placeholder,
  error,
  registration,
  children,
  describedBy,
}: FormFieldProps) {
  const errorId = `${id}-error`;
  const described = [describedBy, error ? errorId : undefined].filter(Boolean).join(" ") || undefined;
  return (
    <div className='space-y-2'>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        {...registration}
      />
      {children}
      {error && (
        <FormAlert tone='error' id={errorId}>
          {error}
        </FormAlert>
      )}
    </div>
  );
}
