import { serverApi } from "@/lib/api/server";
import type { components } from "@/lib/api/schema";

type IntakeContext = components["schemas"]["IntakeContextBody"];

/**
 * The plan wizard's context (whose plan, their profile). null when the caller
 * may not generate for that trainee.
 */
export async function getIntakeContext(student: string | undefined): Promise<IntakeContext | null> {
  const api = await serverApi();
  const { data, response } = await api.GET("/training/intake-context", {
    params: { query: student ? { student } : {} },
  });
  if (response.status === 403) return null;
  if (!data) throw new Error(`GET /training/intake-context failed: ${response.status}`);
  return data;
}
