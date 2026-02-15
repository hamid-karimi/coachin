import type { CoachRelationship } from "../types";
import { AddCoachByCodeForm } from "./AddCoachByCodeForm";

interface CoachesSectionProps {
  coaches: CoachRelationship[];
  canManage: boolean;
}

export function CoachesSection({ coaches, canManage }: CoachesSectionProps) {
  const hasCoaches = coaches.length > 0;

  return (
    <section className='bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 shadow-sm'>
      <header className='flex items-center justify-between mb-4'>
        <h2 className='text-lg font-bold text-slate-900 dark:text-white'>
          My Coaches
        </h2>
      </header>

      {canManage && (
        <div className='mb-4'>
          <AddCoachByCodeForm />
        </div>
      )}

      {hasCoaches ? (
        <ul className='space-y-3'>
          {coaches.map((relationship) => {
            const { coach } = relationship;
            const initials = coach.email?.[0]?.toUpperCase() ?? "?";

            return (
              <li
                key={coach.id}
                className='flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800'>
                <div className='w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-sm font-bold text-blue-800 dark:text-white'>
                  {initials}
                </div>
                <div className='flex-1'>
                  <p className='text-sm font-semibold text-slate-900 dark:text-white'>
                    {coach.full_name || coach.email || "Unknown coach"}
                  </p>
                  <p className='text-xs text-slate-500 dark:text-slate-400'>
                    {relationship.sport_type?.name || "General coaching"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className='text-sm text-slate-500 dark:text-slate-400'>
          You don’t have a coach yet.
        </p>
      )}
    </section>
  );
}
