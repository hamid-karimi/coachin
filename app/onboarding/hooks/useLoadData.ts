import { useEffect, useState } from "react";
import { getSportTypes, getUserSchedules } from "../actions";

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
  isLoading: boolean;
  error: string | null;
}

export function useLoadData(): UseLoadDataState {
  const [sports, setSports] = useState<SportType[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [sportsData, schedulesData] = await Promise.all([
          getSportTypes(),
          getUserSchedules(),
        ]);
        setSports(sportsData || []);
        setSchedules(schedulesData || []);
      } catch (err) {
        console.error("Failed to load data:", err);
        setError(
          err instanceof Error ? err.message : "خطا در بارگذاری اطلاعات",
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  return { sports, schedules, isLoading, error };
}
