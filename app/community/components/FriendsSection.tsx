"use client";

import type { ProfileSummary } from "../types";
import { FollowToggleButton } from "./FollowToggleButton";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Search, UsersRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { TierBadge } from "@/components/design-system/tier-badge";
import { tierFromLeague } from "@/lib/tiers";

function profileInitials(profile: ProfileSummary) {
  const name = profile.full_name?.trim();
  if (name) {
    return name[0]?.toUpperCase() ?? "?";
  }
  return profile.email?.[0]?.toUpperCase() ?? "?";
}

interface FriendsSectionProps {
  followingProfiles: ProfileSummary[];
  discoverProfiles: ProfileSummary[];
  followingUserIds: string[];
  searchTerm: string;
}

function displayName(profile: ProfileSummary) {
  return profile.full_name || profile.email?.split("@")[0] || "User";
}

function PersonRow({
  profile,
  action,
}: {
  profile: ProfileSummary;
  action: React.ReactNode;
}) {
  return (
    <li className='bg-card border-border flex items-center gap-3 rounded-xl border p-3'>
      <Avatar className='size-10'>
        {profile.avatar_url ? (
          <AvatarImage src={profile.avatar_url} alt={displayName(profile)} />
        ) : null}
        <AvatarFallback>{profileInitials(profile)}</AvatarFallback>
      </Avatar>
      <div className='min-w-0 flex-1'>
        <p className='text-foreground truncate text-sm font-semibold'>
          {displayName(profile)}
        </p>
        <p className='text-muted-foreground flex items-center gap-1.5 text-xs'>
          Lv {profile.level ?? 1} · {(profile.xp ?? 0).toLocaleString()} XP
          <TierBadge
            tier={tierFromLeague(profile.league_tier)}
            className='px-1.5 py-0 text-[10px]'
          />
        </p>
      </div>
      {action}
    </li>
  );
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

  const trimmedQuery = query.trim();

  return (
    <section className='space-y-4'>
      <div>
        <h2 className='text-foreground text-[17px] font-bold'>Circle</h2>
        <p className='text-muted-foreground mt-0.5 text-sm'>
          Follow people to build your Circle board.
        </p>
      </div>

      {/* Search */}
      <div className='relative'>
        <Search
          className='text-muted-foreground absolute top-1/2 left-3.5 size-4 -translate-y-1/2'
          aria-hidden
        />
        <Input
          id='friends-search'
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          type='search'
          autoComplete='off'
          aria-label='Search by name or email'
          placeholder='Search by name or email'
          className='pl-10'
        />
      </div>

      {/* Search results */}
      {trimmedQuery ? (
        isLoading ? (
          <ul className='animate-pulse space-y-2'>
            {[0, 1, 2].map((index) => (
              <li key={index} className='bg-secondary h-16 rounded-xl' />
            ))}
          </ul>
        ) : profiles.length === 0 ? (
          <div className='border-border flex items-center gap-3 rounded-xl border border-dashed p-4'>
            <Search className='text-muted-foreground size-5 shrink-0' aria-hidden />
            <div>
              <p className='text-foreground text-sm font-semibold'>
                No one matches &ldquo;{trimmedQuery}&rdquo;
              </p>
              <p className='text-muted-foreground text-[13px]'>
                Check the spelling or invite them to CoachIn.
              </p>
            </div>
          </div>
        ) : (
          <ul className='space-y-2'>
            {profiles.map((profile) => {
              const isFollowing = mergedFollowingIds.has(profile.id);

              return (
                <PersonRow
                  key={profile.id}
                  profile={profile}
                  action={
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
                  }
                />
              );
            })}
          </ul>
        )
      ) : null}

      {/* Following */}
      <div className='space-y-2'>
        <p className='text-overline'>
          Following · {followingProfiles.length}
        </p>
        {followingProfiles.length === 0 ? (
          <div className='border-border flex flex-col items-center gap-2.5 rounded-xl border border-dashed px-5 py-8 text-center'>
            <span className='bg-secondary text-muted-foreground grid size-12 place-items-center rounded-full'>
              <UsersRound className='size-5' aria-hidden />
            </span>
            <p className='text-foreground font-semibold'>
              Your Circle is empty
            </p>
            <p className='text-muted-foreground max-w-75 text-sm leading-relaxed'>
              Follow a few people to unlock the Circle board — friendly rivalry
              works. Search above to find them.
            </p>
          </div>
        ) : (
          <ul className='space-y-2'>
            {followingProfiles.map((profile) => (
              <PersonRow
                key={profile.id}
                profile={profile}
                action={
                  <FollowToggleButton targetUserId={profile.id} isFollowing />
                }
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
