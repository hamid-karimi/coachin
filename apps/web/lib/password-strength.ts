/** Live checklist shown under new-password fields (same rules as the API). */
export const PASSWORD_RULES = [
  { key: "length", label: "8+ characters", test: (v: string) => v.length >= 8 },
  { key: "case", label: "Upper & lowercase", test: (v: string) => /[A-Z]/.test(v) && /[a-z]/.test(v) },
  { key: "number", label: "A number", test: (v: string) => /[0-9]/.test(v) },
] as const;

/** Not required; only lifts the strength meter. */
export const BONUS_RULE = { label: "A symbol (optional, +1 strength)", test: (v: string) => /[^A-Za-z0-9]/.test(v) };

/** 0–4 filled meter segments: one per rule met, plus one for a symbol. */
export function passwordStrength(password: string): number {
  if (!password) return 0;
  const passed = PASSWORD_RULES.filter((rule) => rule.test(password)).length;
  return passed + (BONUS_RULE.test(password) ? 1 : 0);
}
