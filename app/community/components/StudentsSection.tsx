import type { StudentRelationship } from "../types";
import type { CoachInviteCodeSummary, SportTypeSummary } from "../types";
import { GenerateInviteCodeForm } from "./GenerateInviteCodeForm";
import { AssignPlanButton } from "./AssignPlanButton";

interface StudentsSectionProps {
  students: StudentRelationship[];
  sportTypes: SportTypeSummary[];
  inviteCodes: CoachInviteCodeSummary[];
  canManage: boolean;
}

export function StudentsSection({
  students,
  sportTypes,
  inviteCodes,
  canManage,
}: StudentsSectionProps) {
  const hasStudents = students.length > 0;

  return (
    <section className='bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 shadow-sm'>
      <header className='flex items-center justify-between mb-4'>
        <h2 className='text-lg font-bold text-slate-900 dark:text-white'>
          My Students
        </h2>
      </header>

      {canManage && (
        <div className='mb-4'>
          <GenerateInviteCodeForm
            sportTypes={sportTypes}
            inviteCodes={inviteCodes}
          />
        </div>
      )}

      {hasStudents ? (
        <ul className='space-y-3'>
          {students.map((relationship) => {
            const { student } = relationship;
            const initials = student.email?.[0]?.toUpperCase() ?? "?";

            return (
              <li
                key={student.id}
                className='flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-sm font-bold text-green-800 dark:text-white'>
                    {initials}
                  </div>
                  <div>
                    <p className='text-sm font-semibold text-slate-900 dark:text-white'>
                      {student.full_name || student.email || "Unknown student"}
                    </p>
                    <p className='text-xs text-slate-500 dark:text-slate-400'>
                      {relationship.sport_type?.name || "General coaching"} ·
                      Level {student.level ?? 1}
                    </p>
                  </div>
                </div>
                <div className='text-sm font-bold text-slate-700 dark:text-slate-200'>
                  <p className='text-right mb-1'>
                    {student.xp?.toLocaleString() ?? 0} XP
                  </p>
                  {canManage && <AssignPlanButton studentId={student.id} />}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className='text-sm text-slate-500 dark:text-slate-400'>
          You don’t have students yet. Share your invite code.
        </p>
      )}
    </section>
  );
}
