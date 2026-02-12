import type { ProfileSummary } from "../types";
import { FollowToggleButton } from "./FollowToggleButton";
import Link from "next/link";

interface FriendsSectionProps {
  followingProfiles: ProfileSummary[];
  discoverProfiles: ProfileSummary[];
  followingUserIds: string[];
  searchTerm: string;
  discoverPage: number;
  discoverHasNextPage: boolean;
}

function displayName(profile: ProfileSummary) {
  return profile.full_name || profile.email?.split("@")[0] || "کاربر";
}

export function FriendsSection({
  followingProfiles,
  discoverProfiles,
  followingUserIds,
  searchTerm,
  discoverPage,
  discoverHasNextPage,
}: FriendsSectionProps) {
  const previousPage = Math.max(1, discoverPage - 1);
  const nextPage = discoverPage + 1;

  return (
    <section className='bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 shadow-sm space-y-4'>
      <header className='space-y-1'>
        <h2 className='text-lg font-bold text-slate-900 dark:text-white'>
          Friends & Circle
        </h2>
        <p className='text-xs text-slate-500 dark:text-slate-400'>
          کاربران را جستجو کن و Circle خودت را مستقل از لیدربرد مدیریت کن.
        </p>
      </header>

      <form className='space-y-3' method='get'>
        <input type='hidden' name='tab' value='leaderboards' />
        <input type='hidden' name='board' value='circle' />
        <input type='hidden' name='page' value='1' />
        <label className='text-xs text-slate-500 dark:text-slate-400 block'>
          جستجوی کاربر (نام یا ایمیل)
        </label>
        <div className='flex gap-2'>
          <input
            name='q'
            type='text'
            defaultValue={searchTerm}
            placeholder='مثال: ali'
            className='flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm'
          />
          <button
            type='submit'
            className='rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm'>
            Search
          </button>
        </div>
      </form>

      <div className='space-y-2'>
        <p className='text-xs text-slate-500 dark:text-slate-400'>
          Following من
        </p>
        {followingProfiles.length === 0 ? (
          <p className='text-sm text-slate-500 dark:text-slate-400'>
            هنوز کسی را فالو نکرده‌ای.
          </p>
        ) : (
          <ul className='space-y-2'>
            {followingProfiles.map((profile) => (
              <li
                key={profile.id}
                className='rounded-xl bg-slate-50 dark:bg-slate-800 p-3 flex items-center justify-between gap-3'>
                <div>
                  <p className='text-sm font-semibold text-slate-900 dark:text-white'>
                    {displayName(profile)}
                  </p>
                  <p className='text-xs text-slate-500 dark:text-slate-400'>
                    Level {profile.level ?? 1} ·{" "}
                    {(profile.xp ?? 0).toLocaleString()} XP
                  </p>
                </div>
                <FollowToggleButton targetUserId={profile.id} isFollowing />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className='space-y-2'>
        <p className='text-xs text-slate-500 dark:text-slate-400'>
          نتایج جستجو
        </p>
        {discoverProfiles.length === 0 ? (
          <p className='text-sm text-slate-500 dark:text-slate-400'>
            نتیجه‌ای پیدا نشد.
          </p>
        ) : (
          <>
            <ul className='space-y-2'>
              {discoverProfiles.map((profile) => {
                const isFollowing = followingUserIds.includes(profile.id);

                return (
                  <li
                    key={profile.id}
                    className='rounded-xl bg-slate-50 dark:bg-slate-800 p-3 flex items-center justify-between gap-3'>
                    <div>
                      <p className='text-sm font-semibold text-slate-900 dark:text-white'>
                        {displayName(profile)}
                      </p>
                      <p className='text-xs text-slate-500 dark:text-slate-400'>
                        Level {profile.level ?? 1} ·{" "}
                        {(profile.xp ?? 0).toLocaleString()} XP
                      </p>
                    </div>
                    <FollowToggleButton
                      targetUserId={profile.id}
                      isFollowing={isFollowing}
                    />
                  </li>
                );
              })}
            </ul>

            <div className='flex items-center justify-between pt-2'>
              <Link
                href={`?tab=leaderboards&board=circle&q=${encodeURIComponent(searchTerm)}&page=${previousPage}`}
                className={`text-xs px-3 py-1.5 rounded-lg ${
                  discoverPage <= 1
                    ? "pointer-events-none bg-slate-100 dark:bg-slate-800 text-slate-400"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                }`}>
                قبلی
              </Link>

              <span className='text-xs text-slate-500 dark:text-slate-400'>
                صفحه {discoverPage}
              </span>

              <Link
                href={`?tab=leaderboards&board=circle&q=${encodeURIComponent(searchTerm)}&page=${nextPage}`}
                className={`text-xs px-3 py-1.5 rounded-lg ${
                  !discoverHasNextPage
                    ? "pointer-events-none bg-slate-100 dark:bg-slate-800 text-slate-400"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                }`}>
                بعدی
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
