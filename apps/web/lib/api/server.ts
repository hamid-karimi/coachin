import createClient from "openapi-fetch";
import createQueryClient from "openapi-react-query";
import { cookies } from "next/headers";
import type { paths } from "./schema";

/**
 * API client for Server Components and route rendering. Talks to the API
 * container directly (not through Caddy) and forwards the visitor's cookies
 * so the API sees the same session as the browser.
 */
export async function serverApi() {
  // Read cookies first: it marks the route dynamic, so a build never tries to
  // prerender a page that needs the live API.
  const cookieHeader = (await cookies()).toString();
  const origin = process.env.API_INTERNAL_URL;
  if (!origin) {
    throw new Error("API_INTERNAL_URL is not set (e.g. http://api:8080)");
  }
  return createClient<paths>({
    baseUrl: `${origin}/api/v1`,
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    cache: "no-store",
  });
}

/**
 * Query options built on the server client, for prefetching in Server
 * Components. Keys match the browser's `$api` ones, so hydrated data is
 * picked up without a refetch.
 */
export async function serverQueries() {
  return createQueryClient(await serverApi());
}
