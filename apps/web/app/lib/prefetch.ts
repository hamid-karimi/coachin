import { dehydrate, type DehydratedState, type QueryClient } from "@tanstack/react-query";
import { serverQueries } from "@/lib/api/server";
import { getQueryClient } from "@/lib/query-client";

type ServerQueries = Awaited<ReturnType<typeof serverQueries>>;

/**
 * Prefetches API queries on the server and returns the state for a
 * `<HydrationBoundary>`:
 * `prefetchQueries((api, qc) => [qc.prefetchQuery(api.queryOptions("get", "/routine"))])`.
 * Failed queries are left out; the client retries them.
 */
export async function prefetchQueries(
  build: (api: ServerQueries, queryClient: QueryClient) => Promise<void>[],
): Promise<DehydratedState> {
  const queryClient = getQueryClient();
  await Promise.all(build(await serverQueries(), queryClient));
  return dehydrate(queryClient);
}
