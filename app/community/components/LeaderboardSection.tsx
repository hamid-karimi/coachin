import type { ProfileSummary } from "../types";
import { FollowToggleButton } from "./FollowToggleButton";

interface LeaderboardSectionProps {
  leaderboard: ProfileSummary[];
  currentUserId: string;
  title?: string;
  emptyMessage?: string;
  enableFollowActions?: boolean;
  followingUserIds?: string[];
}

export function LeaderboardSection({
  leaderboard,
  currentUserId,
  title = "🏆 برترین‌های هفته",
  emptyMessage = "هنوز هیچ امتیازی ثبت نشده است.",
  enableFollowActions = false,
  followingUserIds = [],
}: LeaderboardSectionProps) {
  const highlightClass = "bg-amber-50 dark:bg-amber-900";

  if (leaderboard.length === 0) {
    return (
      <section className='rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm'>
        <div className='bg-gradient-to-r from-yellow-500 to-orange-500 p-4 text-white'>
          <h2 className='text-xl font-bold flex items-center gap-2'>{title}</h2>
        </div>
        <div className='p-6 text-sm text-slate-500 dark:text-slate-400'>
          {emptyMessage}
        </div>
      </section>
    );
  }

  return (
    <section className='rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm'>
      <div className='bg-gradient-to-r from-yellow-500 to-orange-500 p-4 text-white'>
        <h2 className='text-xl font-bold flex items-center gap-2'>{title}</h2>
      </div>
      <div className='divide-y divide-slate-100 dark:divide-slate-800'>
        {leaderboard.map((profile, index) => {
          const isCurrent = profile.id === currentUserId;
          const positionClass = isCurrent ? highlightClass : "";
          const initials = profile.email?.[0]?.toUpperCase() ?? "؟";

          return (
            <div
              key={profile.id}
              className={`flex items-center p-4 gap-3 ${positionClass}`}>
              <div className='w-8 text-center font-bold text-slate-500 dark:text-slate-400'>
                {index + 1}
              </div>
              <div className='w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-semibold text-slate-700 dark:text-white'>
                {initials}
              </div>
              <div className='flex-1'>
                <p className='text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2'>
                  {profile.full_name ||
                    profile.email?.split("@")[0] ||
                    "رکورددار"}
                  {isCurrent && (
                    <span className='text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full'>
                      تو
                    </span>
                  )}
                </p>
                <p className='text-xs text-slate-500 dark:text-slate-400'>
                  Level {profile.level ?? 1}
                </p>
              </div>
              <div className='font-mono font-bold text-indigo-600 dark:text-indigo-300'>
                {(profile.xp ?? 0).toLocaleString()} XP
              </div>
              {enableFollowActions && !isCurrent && (
                <FollowToggleButton
                  targetUserId={profile.id}
                  isFollowing={followingUserIds.includes(profile.id)}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
