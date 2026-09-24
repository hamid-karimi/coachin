import { cache } from "react";
import { redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import type { components } from "@/lib/api/schema";
import { homeFor } from "@/lib/roles";

export type Me = components["schemas"]["MeBody"];

/**
 * The signed-in viewer, or null without a live session. Deduplicated per
 * request, so the layout and the page share one API call. Any other failure
 * (API down) throws to the error boundary instead of posing as signed out.
 */
export const getMe = cache(async (): Promise<Me | null> => {
  const api = await serverApi();
  const { data, error, response } = await api.GET("/me");
  if (response.status === 401) return null;
  if (!data) throw new Error(`GET /me failed: ${response.status} ${error?.detail ?? ""}`.trim());
  return data;
});

/** Sign-in screens: a live session goes straight to its home instead. */
export async function redirectIfSignedIn(): Promise<void> {
  const me = await getMe();
  if (me) redirect(homeFor(me.role));
}
