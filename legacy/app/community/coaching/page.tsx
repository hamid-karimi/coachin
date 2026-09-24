import { redirect } from "next/navigation";

/**
 * The Coaching tab was folded into Circle (trainee side) and the /coaching
 * hub (coach side) — this segment only preserves old links.
 */
export default function CommunityCoachingRedirect() {
  redirect("/community/circle");
}
