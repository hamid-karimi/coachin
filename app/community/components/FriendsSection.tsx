"use client";

import type { ProfileSummary } from "../types";
import { FollowToggleButton } from "./FollowToggleButton";
import { useEffect, useMemo, useState } from "react";

interface FriendsSectionProps {
  followingProfiles: ProfileSummary[];
  discoverProfiles: ProfileSummary[];
  followingUserIds: string[];
  searchTerm: string;
}

function displayName(profile: ProfileSummary) {
  return profile.full_name || profile.email?.split("@")[0] || "کاربر";
}

export function FriendsSection({
  followingProfiles,
  discoverProfiles,
  followingUserIds,
  searchTerm,
}: FriendsSectionProps) {
  const [query, setQuery] = useState(searchTerm);
  const [profiles, setProfiles] = useState(discoverProfiles);
  const [remoteFollowingIds, setRemoteFollowingIds] =
    useState<string[]>(followingUserIds);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mergedFollowingIds = useMemo(() => {
    return new Set([...followingUserIds, ...remoteFollowingIds]);
  }, [followingUserIds, remoteFollowingIds]);

  useEffect(() => {
    const controller = new AbortController();
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setProfiles([]);
      setRemoteFollowingIds(followingUserIds);
      setIsLoading(false);
      setErrorMessage(null);
      return () => controller.abort();
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const response = await fetch(
          `/community/api/discover?q=${encodeURIComponent(trimmedQuery)}&limit=8`,
          {
            method: "GET",
            signal: controller.signal,
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error("Search request failed");
        }

        const payload = (await response.json()) as {
          profiles?: ProfileSummary[];
          followingUserIds?: string[];
        };

        setProfiles(payload.profiles ?? []);
        setRemoteFollowingIds(payload.followingUserIds ?? []);
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }

        setErrorMessage("خطا در دریافت نتایج جستجو");
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [query, followingUserIds]);

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

      <div className='space-y-3'>
        <label className='text-xs text-slate-500 dark:text-slate-400 block'>
          جستجوی کاربر (نام یا ایمیل)
        </label>
        <div className='space-y-2'>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type='search'
            autoComplete='off'
            placeholder='مثال: ali'
            className='flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm'
          />
          <p className='text-[11px] text-slate-500 dark:text-slate-400'>
            {query.trim()
              ? "نتایج به‌صورت خودکار به‌روزرسانی می‌شوند."
              : "نتایج فقط بعد از وارد کردن عبارت جستجو نمایش داده می‌شوند."}
          </p>
        </div>
      </div>

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
        {!query.trim() ? (
          <p className='text-sm text-slate-500 dark:text-slate-400'>
            برای جستجو، نام یا ایمیل کاربر را وارد کن.
          </p>
        ) : errorMessage ? (
          <p className='text-sm text-rose-500'>{errorMessage}</p>
        ) : isLoading ? (
          <p className='text-sm text-slate-500 dark:text-slate-400'>
            در حال جستجو...
          </p>
        ) : profiles.length === 0 ? (
          <p className='text-sm text-slate-500 dark:text-slate-400'>
            نتیجه‌ای پیدا نشد.
          </p>
        ) : (
          <ul className='space-y-2'>
            {profiles.map((profile) => {
              const isFollowing = mergedFollowingIds.has(profile.id);

              return (
                <li
                  key={profile.id}
                  className='rounded-xl bg-slate-50 dark:bg-slate-800 p-3 flex items-center justify-between gap-3'>
                  <div>
                    <p className='text-sm font-semibold text-slate-900 dark:text-white'>
                      {displayName(profile)}
                    </p>
                    <p className='text-xs text-slate-500 dark:text-slate-400'>
                      {profile.email ? `${profile.email} · ` : ""}
                      Level {profile.level ?? 1} ·{" "}
                      {(profile.xp ?? 0).toLocaleString()} XP
                    </p>
                  </div>
                  <FollowToggleButton
                    targetUserId={profile.id}
                    isFollowing={isFollowing}
                    onSuccess={() => {
                      setProfiles((currentProfiles) =>
                        currentProfiles.filter(
                          (currentProfile) => currentProfile.id !== profile.id,
                        ),
                      );
                      setRemoteFollowingIds((currentFollowingIds) =>
                        currentFollowingIds.includes(profile.id)
                          ? currentFollowingIds
                          : [...currentFollowingIds, profile.id],
                      );
                    }}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
