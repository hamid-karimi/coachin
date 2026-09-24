import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { prefetchQueries } from "@/app/lib/prefetch";
import { CalendarView } from "./components/calendar-view";
import { calendarQuery } from "./lib/calendar";

export const metadata: Metadata = { title: "Calendar · CoachIn" };

type SearchParams = Promise<{ week?: string | string[] }>;

export default async function CalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const { week } = await searchParams;
  const state = await prefetchQueries((api, qc) => [
    qc.prefetchQuery(api.queryOptions("get", "/calendar", calendarQuery(typeof week === "string" ? week : null))),
  ]);
  return (
    <HydrationBoundary state={state}>
      <CalendarView />
    </HydrationBoundary>
  );
}
