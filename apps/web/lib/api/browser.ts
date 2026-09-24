import createFetchClient from "openapi-fetch";
import createClient from "openapi-react-query";
import type { paths } from "./schema";

/**
 * API client for the browser. Same origin as the page (Caddy routes /api/*
 * to the Go API), so the session cookie rides along automatically.
 */
export const fetchClient = createFetchClient<paths>({ baseUrl: "/api/v1" });

/** Typed TanStack Query hooks: `$api.useQuery("get", "/me")`. */
export const $api = createClient(fetchClient);
