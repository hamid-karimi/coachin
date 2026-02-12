"use client";

import { useActionState } from "react";
import { logWorkout } from "../actions"; // مسیر اکشن خود را اصلاح کنید
import { ScheduleItem } from "../page";

type WorkoutCardProps = {
  item: ScheduleItem; // تایپ دقیق ScheduleItem را اینجا ایمپورت کنید
};

const initialState = {
  error: "",
  success: false,
};

export function WorkoutCard({ item }: WorkoutCardProps) {
  // در Next.js 15/16 و React 19 نام هوک useActionState است
  // اگر روی نسخه‌های قدیمی‌تر هستید useFormState است
  const [state, action, isPending] = useActionState(logWorkout, initialState);

  return (
    <div className='rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm transition-shadow hover:shadow-md'>
      <div className='flex justify-between items-start mb-4'>
        <div>
          <h3 className='text-2xl font-bold text-slate-900 dark:text-white'>
            {item.sport_types?.name || "تمرین"}
          </h3>
          <p className='text-slate-600 dark:text-slate-300 text-sm mt-1'>
            {item.time ? `ساعت ${item.time.slice(0, 5)}` : "زمان شناور"}
            {item.sport_types?.xp_multiplier
              ? ` • ضریب ${item.sport_types.xp_multiplier}x`
              : ""}
          </p>
        </div>
        <div className='text-3xl opacity-40'>🏃‍♂️</div>
      </div>

      <form action={action}>
        <input type='hidden' name='sport_type_id' value={item.sport_type_id} />

        <div className='flex flex-col sm:flex-row gap-3 mb-4'>
          <input
            type='number'
            name='duration'
            placeholder='دقیقه'
            className='w-full sm:w-28 p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/60 text-slate-900 dark:text-white text-center'
            defaultValue={60}
            min={1}
            disabled={isPending}
          />
          <input
            type='text'
            name='notes'
            placeholder='یادداشت کوتاه...'
            className='flex-1 p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/60 text-slate-900 dark:text-white'
            disabled={isPending}
          />
        </div>

        {state?.error && (
          <p className='text-red-500 text-sm mb-3 bg-red-50 p-2 rounded'>
            {state.error}
          </p>
        )}

        <button
          type='submit'
          disabled={isPending}
          className='w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg shadow-blue-200/60 transition disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2'>
          {isPending ? (
            <>
              <span className='animate-spin'>⏳</span> در حال ثبت...
            </>
          ) : (
            "ثبت تمرین و دریافت XP"
          )}
        </button>
      </form>
    </div>
  );
}
