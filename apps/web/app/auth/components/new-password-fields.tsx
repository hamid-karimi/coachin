import type { UseFormRegisterReturn } from "react-hook-form";
import { FormField } from "./form-field";
import { PasswordStrength } from "./password-strength";

interface NewPasswordFieldsProps {
  password: string;
  passwordRegistration: UseFormRegisterReturn;
  confirmRegistration: UseFormRegisterReturn;
  passwordError?: string;
  confirmError?: string;
  label?: string;
}

/** New password (with the strength checklist) + its confirmation. */
export function NewPasswordFields({
  password,
  passwordRegistration,
  confirmRegistration,
  passwordError,
  confirmError,
  label = "Password",
}: NewPasswordFieldsProps) {
  return (
    <>
      <FormField
        id='password'
        label={label}
        type='password'
        autoComplete='new-password'
        placeholder='••••••••'
        error={passwordError}
        registration={passwordRegistration}
        describedBy='password-requirements'>
        <PasswordStrength id='password-requirements' password={password} />
      </FormField>
      <FormField
        id='confirmPassword'
        label='Confirm password'
        type='password'
        autoComplete='new-password'
        placeholder='Repeat password'
        error={confirmError}
        registration={confirmRegistration}
      />
    </>
  );
}
