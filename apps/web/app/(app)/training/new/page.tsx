import type { Metadata } from "next";
import { ComingSoon } from "../../components/coming-soon";

export const metadata: Metadata = { title: "New plan · CoachIn" };

export default function NewPlanPage() {
  return (
    <ComingSoon
      title='New plan'
      greeting='Running or building muscle'
      next='The AI plan wizards arrive here in the next training update.'
    />
  );
}
