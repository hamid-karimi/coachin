"use client";

import { useMutationFeedback } from "@/components/hooks/use-mutation-feedback";
import { $api } from "@/lib/api/browser";
import type { Board } from "../lib/community";

export function useLeaderboard(board: Board) {
  return $api.useSuspenseQuery("get", "/community/leaderboard", { params: { query: { board } } }).data;
}

export function useClubs() {
  return $api.useSuspenseQuery("get", "/community/clubs").data.clubs;
}

/** Club changes move the club list and the boards. */
const CLUB_KEYS = [
  ["get", "/community/clubs"],
  ["get", "/community/leaderboard"],
];

export function useCreateClub(onDone?: () => void) {
  return $api.useMutation("post", "/community/clubs", useMutationFeedback(CLUB_KEYS, onDone));
}

export function useJoinClub(onDone?: () => void) {
  return $api.useMutation("post", "/community/clubs/join", useMutationFeedback(CLUB_KEYS, onDone));
}

export function useSetPrimaryClub() {
  return $api.useMutation("put", "/community/clubs/{id}/primary", useMutationFeedback(CLUB_KEYS));
}

export function useLeaveClub(onDone?: () => void) {
  return $api.useMutation("delete", "/community/clubs/{id}/membership", useMutationFeedback(CLUB_KEYS, onDone));
}
