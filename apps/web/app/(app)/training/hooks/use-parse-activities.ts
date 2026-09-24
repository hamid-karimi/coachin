"use client";

import { useMutationFeedback } from "@/components/hooks/use-mutation-feedback";
import { $api } from "@/lib/api/browser";
import { watchFilesForm } from "../lib/watch-files";

/** Reads watch files into run summaries (nothing is stored). */
export function useParseActivities() {
  const mutation = $api.useMutation("post", "/activities/parse", useMutationFeedback([]));
  return {
    ...mutation,
    parse: (files: File[], options?: Parameters<typeof mutation.mutate>[1]) =>
      mutation.mutate({ body: { activities: [] }, bodySerializer: () => watchFilesForm(files) }, options),
  };
}
