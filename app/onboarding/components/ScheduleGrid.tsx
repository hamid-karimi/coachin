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

const DAYS = [
  { id: 0, name: "یکشنبه" },
  { id: 1, name: "دوشنبه" },
  { id: 2, name: "سه‌شنبه" },
  { id: 3, name: "چهارشنبه" },
  { id: 4, name: "پنج‌شنبه" },
  { id: 5, name: "جمعه" },
  { id: 6, name: "شنبه" },
];

interface ScheduleGridProps {
  schedules: Schedule[];
  onDeleteClick: (
    scheduleId: string,
    formAction: (formData: FormData) => void,
  ) => void;
  deleteAction: (formData: FormData) => void;
  isDeleting?: boolean;
}

export function ScheduleGrid({
  schedules,
  onDeleteClick,
  deleteAction,
  isDeleting = false,
}: ScheduleGridProps) {
  return (
    <div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-8'>
      {DAYS.map((day) => {
        const dayItems: Schedule[] =
          schedules?.filter((s: Schedule) => s.day_of_week === day.id) || [];

        return (
          <div
            key={day.id}
            className='border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-700/50 hover:shadow-md transition'>
            <h3 className='font-bold text-lg mb-3 border-b border-slate-200 dark:border-slate-600 pb-2 text-slate-800 dark:text-slate-200'>
              {day.name}
            </h3>

            {dayItems.length === 0 ? (
              <p className='text-sm text-slate-500 dark:text-slate-400 italic'>
                استراحت
              </p>
            ) : (
              <ul className='space-y-2'>
                {dayItems.map((item: Schedule) => (
                  <li
                    key={item.id}
                    className='flex justify-between items-center bg-white dark:bg-slate-600 p-2 rounded border border-slate-200 dark:border-slate-500 text-sm'>
                    <span className='flex items-center gap-2'>
                      <span className='font-semibold text-slate-900 dark:text-white'>
                        {item.sport_types?.name}
                      </span>
                      {item.time && (
                        <span className='text-slate-500 dark:text-slate-400 text-xs'>
                          ({item.time.slice(0, 5)})
                        </span>
                      )}
                    </span>

                    <button
                      onClick={() => {
                        const formData = new FormData();
                        formData.append("scheduleId", item.id);
                        onDeleteClick(item.id, deleteAction);
                      }}
                      className='text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 px-2 disabled:opacity-50'
                      disabled={isDeleting}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
