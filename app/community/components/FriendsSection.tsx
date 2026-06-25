"use client";

import type { ProfileSummary } from "../types";
import { FollowToggleButton } from "./FollowToggleButton";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

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
    <Card>
      <CardHeader>
        <CardTitle className='text-lg font-bold'>Friends &amp; Circle</CardTitle>
        <CardDescription>
          Search users and manage your Circle independently of leaderboards.
        </CardDescription>
      </CardHeader>

      <CardContent className='space-y-4'>
        <div className='space-y-2'>
          <Label htmlFor='friends-search' className='text-muted-foreground'>
            Search users (name or email)
          </Label>
          <Input
            id='friends-search'
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type='search'
            autoComplete='off'
            placeholder='Example: alex'
          />
          <p className='text-[11px] text-muted-foreground'>
            {query.trim()
              ? "Results refresh automatically."
              : "Results appear after you enter a search term."}
          </p>
        </div>

        <div className='space-y-2'>
          <p className='text-xs text-muted-foreground'>My Following</p>
          {followingProfiles.length === 0 ? (
            <p className='text-sm text-muted-foreground'>
              You are not following anyone yet.
            </p>
          ) : (
            <ul className='space-y-2'>
              {followingProfiles.map((profile) => (
                <li
                  key={profile.id}
                  className='flex items-center justify-between gap-3 rounded-xl bg-secondary p-3'>
                  <div className='flex min-w-0 items-center gap-3'>
                    <Avatar className='size-9'>
                      {profile.avatar_url ? (
                        <AvatarImage
                          src={profile.avatar_url}
                          alt={displayName(profile)}
                        />
                      ) : null}
                      <AvatarFallback>
                        {profileInitials(profile)}
                      </AvatarFallback>
                    </Avatar>
                    <div className='min-w-0'>
                      <p className='truncate text-sm font-semibold text-foreground'>
                        {displayName(profile)}
                      </p>
                      <p className='text-xs text-muted-foreground'>
                        Level {profile.level ?? 1} ·{" "}
                        {(profile.xp ?? 0).toLocaleString()} XP
                      </p>
                    </div>
                  </div>
                  <FollowToggleButton targetUserId={profile.id} isFollowing />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className='space-y-2'>
          <p className='text-xs text-muted-foreground'>Search Results</p>
          {!query.trim() ? (
            <p className='text-sm text-muted-foreground'>
              Enter a user name or email to search.
            </p>
          ) : isLoading ? (
            <p className='text-sm text-muted-foreground'>Searching...</p>
          ) : profiles.length === 0 ? (
            <p className='text-sm text-muted-foreground'>No results found.</p>
          ) : (
            <ul className='space-y-2'>
              {profiles.map((profile) => {
                const isFollowing = mergedFollowingIds.has(profile.id);

                return (
                  <li
                    key={profile.id}
                    className='flex items-center justify-between gap-3 rounded-xl bg-secondary p-3'>
                    <div className='flex min-w-0 items-center gap-3'>
                      <Avatar className='size-9'>
                        {profile.avatar_url ? (
                          <AvatarImage
                            src={profile.avatar_url}
                            alt={displayName(profile)}
                          />
                        ) : null}
                        <AvatarFallback>
                          {profileInitials(profile)}
                        </AvatarFallback>
                      </Avatar>
                      <div className='min-w-0'>
                        <p className='truncate text-sm font-semibold text-foreground'>
                          {displayName(profile)}
                        </p>
                        <p className='text-xs text-muted-foreground'>
                          Level {profile.level ?? 1} ·{" "}
                          {(profile.xp ?? 0).toLocaleString()} XP
                        </p>
                      </div>
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
      </CardContent>
    </Card>
  );
}
