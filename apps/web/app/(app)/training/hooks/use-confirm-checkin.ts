"use client";

import { useRouter } from "next/navigation";
import { useMutationFeedback } from "@/components/hooks/use-mutation-feedback";
import { $api } from "@/lib/api/browser";

/** Confirm a check-in, then back to the programs (the banner is gone; Today shows the new week). */
export function useConfirmCheckin() {
  const router = useRouter();
  return $api.useMutation(
    "post",
    "/training/plans/{id}/checkin",
    useMutationFeedback(
      [
        ["get", "/training/programs"],
        ["get", "/today"],
        ["get", "/routine"],
      ],
      () => router.push("/training"),
    ),
  );
}
