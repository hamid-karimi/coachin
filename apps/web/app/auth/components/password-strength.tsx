import { Check, Circle } from "lucide-react";
import { BONUS_RULE, PASSWORD_RULES, passwordStrength } from "@/lib/password-strength";
import { cn } from "@/lib/utils";

const SEGMENTS = [0, 1, 2, 3];

function RuleRow({ ok, label, optional = false }: { ok: boolean; label: string; optional?: boolean }) {
  const Icon = ok ? Check : Circle;
  return (
    <li
      className={cn(
        "flex items-center gap-1.5",
        ok ? "text-success" : optional ? "text-muted-foreground/70" : "text-muted-foreground",
      )}>
      <Icon className='size-3' aria-hidden />
      {label}
    </li>
  );
}

/** Strength meter + rules checklist for a new password. */
export function PasswordStrength({ id, password }: { id: string; password: string }) {
  const strength = passwordStrength(password);
  return (
    <>
      <div className='flex gap-1' aria-hidden>
        {SEGMENTS.map((index) => (
          <span
            key={index}
            className={cn("h-1 flex-1 rounded-full transition-colors", index < strength ? "bg-success" : "bg-border")}
          />
        ))}
      </div>
      <ul id={id} className='space-y-0.5 text-xs' aria-live='polite'>
        {PASSWORD_RULES.map((rule) => (
          <RuleRow key={rule.key} ok={rule.test(password)} label={rule.label} />
        ))}
        <RuleRow ok={BONUS_RULE.test(password)} label={BONUS_RULE.label} optional />
      </ul>
    </>
  );
}
