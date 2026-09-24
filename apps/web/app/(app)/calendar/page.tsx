import type { Metadata } from "next";
import { ComingSoon } from "../components/coming-soon";

export const metadata: Metadata = { title: "Calendar · CoachIn" };

export default function CalendarPage() {
  return (
    <ComingSoon
      title='Calendar'
      greeting='Your week on real dates'
      next='Routine, plan, and logged workouts by date arrive here with the calendar module.'
    />
  );
}
