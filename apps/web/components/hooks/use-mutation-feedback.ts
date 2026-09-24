"use client";

import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import type { components } from "@/lib/api/schema";
import { problemMessage } from "@/lib/api/problem";

type Result = components["schemas"]["ResultBody"];

const TOAST_BY_STATUS = { success: toast.success, info: toast.info } as const;

/**
 * Standard mutation callbacks: toast the API's `{status, message}` (or the
 * problem detail on failure), run `onDone`, then refetch the given queries.
 * `onSuccess` resolves after the refetch, so the mutation stays pending until
 * the screen shows fresh data.
 */
export function useMutationFeedback(invalidate: QueryKey[], onDone?: () => void) {
  const queryClient = useQueryClient();
  return {
    onSuccess: async (result: Result | undefined) => {
      // An empty message means nothing worth announcing (e.g. a no-op toggle).
      if (result?.message) TOAST_BY_STATUS[result.status](result.message);
      onDone?.();
      await Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
    onError: (error: unknown) => {
      toast.error(problemMessage(error));
    },
  };
}
