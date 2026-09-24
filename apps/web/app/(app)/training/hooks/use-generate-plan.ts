"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { $api } from "@/lib/api/browser";
import { problemMessage } from "@/lib/api/problem";

/**
 * Plan generation takes ~15–60 s. On success: toast, refetch what shows
 * plans, and go to the programs page (a coach goes back to Coaching).
 */
function useGenerationCallbacks() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return {
    onSuccess: async (result: { message: string; forStudent: boolean }) => {
      toast.success(result.message);
      await Promise.all(
        [["get", "/training/programs"], ["get", "/today"], ["get", "/routine"]].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
      router.push(result.forStudent ? "/coaching" : "/training");
    },
    onError: (error: unknown) => {
      toast.error(problemMessage(error));
    },
  };
}

export function useGenerateRunningPlan() {
  return $api.useMutation("post", "/training/plans/running", useGenerationCallbacks());
}

export function useGenerateHypertrophyPlan() {
  return $api.useMutation("post", "/training/plans/hypertrophy", useGenerationCallbacks());
}
