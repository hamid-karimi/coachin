"use client";

import type { ProfileSummary } from "../types";
import { FollowToggleButton } from "./FollowToggleButton";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

interface FriendsSectionProps {
  followingProfiles: ProfileSummary[];
  discoverProfiles: ProfileSummary[];
  followingUserIds: string[];
  searchTerm: string;
}

function displayName(profile: ProfileSummary) {
  return profile.full_name || profile.email?.split("@")[0] || "User";
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
  const requestSequenceRef = useRef(0);

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
      return () => controller.abort();
    }

    const currentSequence = ++requestSequenceRef.current;

    const timeoutId = window.setTimeout(async () => {
      try {
        setIsLoading(true);

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

        // Only update state if this is still the most recent request
        if (currentSequence === requestSequenceRef.current) {
          setProfiles(payload.profiles ?? []);
          setRemoteFollowingIds(payload.followingUserIds ?? []);
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }

        setProfiles([]);
        toast.error("Failed to load search results.");
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
          Search users and manage your Circle independently of leaderboards.
        </p>
      </header>

      <div className='space-y-3'>
        <label className='text-xs text-slate-500 dark:text-slate-400 block'>
          Search users (name or email)
        </label>
        <div className='space-y-2'>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type='search'
            autoComplete='off'
            placeholder='Example: alex'
            className='flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm'
          />
          <p className='text-[11px] text-slate-500 dark:text-slate-400'>
            {query.trim()
              ? "Results refresh automatically."
              : "Results appear after you enter a search term."}
          </p>
        </div>
      </div>

      <div className='space-y-2'>
        <p className='text-xs text-slate-500 dark:text-slate-400'>
          My Following
        </p>
        {followingProfiles.length === 0 ? (
          <p className='text-sm text-slate-500 dark:text-slate-400'>
            You are not following anyone yet.
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
          Search Results
        </p>
        {!query.trim() ? (
          <p className='text-sm text-slate-500 dark:text-slate-400'>
            Enter a user name or email to search.
          </p>
        ) : isLoading ? (
          <p className='text-sm text-slate-500 dark:text-slate-400'>
            Searching...
          </p>
        ) : profiles.length === 0 ? (
          <p className='text-sm text-slate-500 dark:text-slate-400'>
            No results found.
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
                      Level {profile.level ?? 1} ·{" "}
                      {(profile.xp ?? 0).toLocaleString()} XP
                    </p>
                  </div>
                  <FollowToggleButton
                    targetUserId={profile.id}
                    isFollowing={isFollowing}
                    onSuccess={() => {
                      setRemoteFollowingIds((currentFollowingIds) =>
                        currentFollowingIds.includes(profile.id)
                          ? currentFollowingIds.filter(
                              (id) => id !== profile.id,
                            )
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
