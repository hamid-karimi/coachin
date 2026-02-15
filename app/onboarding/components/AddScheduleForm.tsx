interface SportType {
  id: string | number;
  name: string;
  [key: string]: unknown;
}

const DAYS = [
  { id: 0, name: "Sunday" },
  { id: 1, name: "Monday" },
  { id: 2, name: "Tuesday" },
  { id: 3, name: "Wednesday" },
  { id: 4, name: "Thursday" },
  { id: 5, name: "Friday" },
  { id: 6, name: "Saturday" },
];

interface AddScheduleFormProps {
  sports: SportType[];
  onSubmit: (formData: FormData) => void;
  isPending?: boolean;
}

export function AddScheduleForm({
  sports,
  onSubmit,
  isPending = false,
}: AddScheduleFormProps) {
  return (
    <div className='bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg mb-10 border border-blue-200 dark:border-blue-800'>
      <h3 className='font-bold mb-4 text-blue-800 dark:text-blue-300'>
        ➕ Add new activity
      </h3>

      <form action={onSubmit} className='flex flex-wrap gap-4 items-end'>
        <div className='flex flex-col gap-2'>
          <label className='text-sm font-medium text-slate-700 dark:text-slate-300'>
            Day of week
          </label>
          <select
            name='day_of_week'
            className='p-2 border border-slate-300 dark:border-slate-600 rounded-md w-40 bg-white dark:bg-slate-700 text-slate-900 dark:text-white'
            disabled={isPending}>
            {DAYS.map((day) => (
              <option key={day.id} value={day.id}>
                {day.name}
              </option>
            ))}
          </select>
        </div>

        <div className='flex flex-col gap-2'>
          <label className='text-sm font-medium text-slate-700 dark:text-slate-300'>
            Sport type
          </label>
          <select
            name='sport_type_id'
            className='p-2 border border-slate-300 dark:border-slate-600 rounded-md w-40 bg-white dark:bg-slate-700 text-slate-900 dark:text-white'
            disabled={isPending}>
            <option value=''>Select</option>
            {sports?.map((sport: SportType) => (
              <option key={sport.id} value={sport.id}>
                {sport.name}
              </option>
            ))}
          </select>
        </div>

        <div className='flex flex-col gap-2'>
          <label className='text-sm font-medium text-slate-700 dark:text-slate-300'>
            Time (optional)
          </label>
          <input
            type='time'
            name='time'
            className='p-2 border border-slate-300 dark:border-slate-600 rounded-md w-32 bg-white dark:bg-slate-700 text-slate-900 dark:text-white'
            disabled={isPending}
          />
        </div>

        <button
          type='submit'
          className='bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed'
          disabled={isPending}>
          {isPending ? "Adding..." : "Add to schedule"}
        </button>
      </form>
    </div>
  );
}
