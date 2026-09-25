import type { DehydratedState } from "@tanstack/react-query";
import { prefetchQueries } from "@/app/lib/prefetch";
import type { ProfileTab } from "@/app/(app)/profile/lib/profile";

type Build = Parameters<typeof prefetchQueries>[0];

/** What each profile tab reads on top of the header (/today + /me/overview). */
const TAB_QUERIES: Record<ProfileTab, Build> = {
  overview: (api, qc) => [qc.prefetchQuery(api.queryOptions("get", "/goals"))],
  progress: (api, qc) => [
    qc.prefetchQuery(api.queryOptions("get", "/me/progress")),
    qc.prefetchQuery(api.queryOptions("get", "/photos")),
  ],
  body: (api, qc) => [
    qc.prefetchQuery(api.queryOptions("get", "/me/body")),
    qc.prefetchQuery(api.queryOptions("get", "/photos")),
  ],
  settings: (api, qc) => [qc.prefetchQuery(api.queryOptions("get", "/me/body"))],
};

/** Prefetches the profile header and the active tab only. */
export function prefetchProfile(tab: ProfileTab): Promise<DehydratedState> {
  return prefetchQueries((api, qc) => [
    qc.prefetchQuery(api.queryOptions("get", "/today")),
    qc.prefetchQuery(api.queryOptions("get", "/me/overview")),
    ...TAB_QUERIES[tab](api, qc),
  ]);
}
