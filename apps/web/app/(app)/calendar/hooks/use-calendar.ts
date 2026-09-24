"use client";

import { useQueryState } from "nuqs";
import { $api } from "@/lib/api/browser";
import { calendarQuery } from "../lib/calendar";

/** The week in `?week=` (this week without it), hydrated from the server prefetch. */
export function useCalendar() {
  const [week] = useQueryState("week");
  return $api.useSuspenseQuery("get", "/calendar", calendarQuery(week)).data;
}
