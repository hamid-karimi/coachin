import { useEffect, useState } from "react";
import {
  getSportTypes,
  getUserSchedules,
  getCurrentPlanWeekItems,
  type PlanWeekItem,
} from "../actions";

interface SportType {
  id: string | number;
  name: string;
  [key: string]: unknown;
}

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

interface UseLoadDataState {
  sports: SportType[];
  schedules: Schedule[];
  planItems: PlanWeekItem[];
  isLoading: boolean;
  error: string | null;
}

export function useLoadData(): UseLoadDataState {
  const [sports, setSports] = useState<SportType[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [planItems, setPlanItems] = useState<PlanWeekItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [sportsData, schedulesData, planItemsData] = await Promise.all([
          getSportTypes(),
          getUserSchedules(),
          getCurrentPlanWeekItems(),
        ]);
        setSports(sportsData || []);
        setSchedules(schedulesData || []);
        setPlanItems(planItemsData || []);
      } catch (err) {
        console.error("Failed to load data:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  return { sports, schedules, planItems, isLoading, error };
}
