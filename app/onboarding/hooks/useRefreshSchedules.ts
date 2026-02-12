import { useEffect, useState } from "react";
import { getUserSchedules } from "../actions";

interface Schedule {
  id: string;
  user_id: string;
  sport_type_id: number;
  day_of_week: number;
  time: string | null;
  sport_types?: {
    name: string;
  };
  [key: string]: unknown;
}

export function useRefreshSchedules(shouldRefresh: boolean): Schedule[] {
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  useEffect(() => {
    if (!shouldRefresh) return;

    const refreshSchedules = async () => {
      try {
        const schedulesData = await getUserSchedules();
        setSchedules(schedulesData || []);
      } catch (err) {
        console.error("Failed to refresh schedules:", err);
      }
    };

    refreshSchedules();
  }, [shouldRefresh]);

  return schedules;
}
