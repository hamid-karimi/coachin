import type { Metadata } from "next";
import { ComingSoon } from "../../components/coming-soon";

export const metadata: Metadata = { title: "Weekly check-in · CoachIn" };

export default function CheckinPage() {
  return (
    <ComingSoon
      title='Weekly check-in'
      greeting='Your week in review'
      next='The scorecard and the suggested adjustment for next week arrive here in a coming training update.'
    />
  );
}
