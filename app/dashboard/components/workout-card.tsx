"use client";

import { useActionState, useEffect, useRef } from "react";
import { logWorkout } from "../actions";
import { ScheduleItem } from "../page";

// استایل ساده برای دکمه لودینگ
const SubmitButton = ({ isPending }: { isPending: boolean }) => (
  <button
    type='submit'
    disabled={isPending}
    className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all transform active:scale-95
      ${
        isPending
          ? "bg-gray-400 cursor-not-allowed"
          : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/30"
      }`}>
    {isPending ? "⏳ در حال ثبت..." : "انجام شد ✅"}
  </button>
);

export function WorkoutCard({
  item,
  completed = false,
}: {
  item: ScheduleItem;
  completed?: boolean;
}) {
  const [state, action, isPending] = useActionState(logWorkout, {});
  const justCompleted = state?.success;
  const confettiFired = useRef(false);

  // وقتی عملیات موفق بود، فشفشه بزن!
  useEffect(() => {
    if (justCompleted && !confettiFired.current) {
      confettiFired.current = true;
      // Dynamic import to avoid SSR issues
      import("canvas-confetti").then((mod) => {
        const confetti = mod.default;
        const duration = 3 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = {
          startVelocity: 30,
          spread: 360,
          ticks: 60,
          zIndex: 0,
        };

        const randomInRange = (min: number, max: number) =>
          Math.random() * (max - min) + min;

        const interval: NodeJS.Timeout = setInterval(function () {
          const timeLeft = animationEnd - Date.now();

          if (timeLeft <= 0) {
            return clearInterval(interval);
          }

          const particleCount = 50 * (timeLeft / duration);
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
          });
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
          });
        }, 250);
      });
    }
  }, [justCompleted]);

  // اگر قبلاً انجام شده (از سرور آمده) یا الان انجام شد:
  if (completed || justCompleted) {
    return (
      <div className='bg-emerald-50 border-2 border-emerald-500 p-6 rounded-2xl animate-in fade-in zoom-in duration-500'>
        <h3 className='text-xl font-bold text-emerald-800 flex items-center gap-2'>
          {item.sport_types?.name} <span className='text-2xl'>🔥</span>
        </h3>
        <p className='text-emerald-600 mt-2 font-medium'>
          {justCompleted ? (
            <>
              عالی بود! استریکت حفظ شد.
              <br />
              <span className='text-sm opacity-75'>
                +{state.earnedXp} XP دریافت کردی.
              </span>
            </>
          ) : (
            "انجام شد ✅"
          )}
        </p>
      </div>
    );
  }

  return (
    <div className='bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 rounded-2xl shadow-sm relative overflow-hidden group'>
      {/* نوار رنگی کنار کارت */}
      <div className='absolute right-0 top-0 bottom-0 w-2 bg-blue-500 rounded-l-full'></div>

      <div className='flex justify-between items-start mb-6 pr-4'>
        <div>
          <h3 className='text-2xl font-black text-slate-800 dark:text-white'>
            {item.sport_types?.name}
          </h3>
          <p className='text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2'>
            <span>⏱️ {item.time ? item.time.slice(0, 5) : "شناور"}</span>
            <span className='bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full font-bold'>
              {item.sport_types?.xp_multiplier}x XP
            </span>
          </p>
        </div>
        <div className='text-5xl opacity-20 grayscale group-hover:grayscale-0 group-hover:scale-110 transition-all duration-500'>
          🏃‍♂️
        </div>
      </div>

      <form action={action}>
        <input type='hidden' name='sport_type_id' value={item.sport_type_id} />

        {/* اینپوت‌های ساده شده برای MVP */}
        <div className='mb-4'>
          <input
            type='text'
            name='notes'
            placeholder='یادداشتی داری؟ (اختیاری)'
            className='w-full bg-slate-50 dark:bg-slate-700/50 border-0 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 transition'
          />
        </div>

        {state?.error && (
          <p className='text-red-500 text-sm mb-3 bg-red-50 p-2 rounded text-center'>
            {state.error}
          </p>
        )}

        <SubmitButton isPending={isPending} />
      </form>
    </div>
  );
}
