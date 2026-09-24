import { Info, Trophy } from "lucide-react";

import type { ProfileSummary } from "../types";
import { FollowToggleButton } from "./FollowToggleButton";
import { LeaderboardRow } from "@/components/design-system/leaderboard-row";
import { tierFromLeague } from "@/lib/tiers";

interface LeaderboardSectionProps {
  leaderboard: ProfileSummary[];
  currentUserId: string;
  title?: string;
  /** Who counts on this board — rendered in the "what counts" banner. */
  whatCounts?: string;
  emptyMessage?: string;
  enableFollowActions?: boolean;
  followingUserIds?: string[];
}

function profileName(profile: ProfileSummary) {
  return (
    profile.full_name || profile.email?.split("@")[0] || "Top athlete"
  );
}

function profileInitials(profile: ProfileSummary) {
  const name = profile.full_name?.trim();
  if (name) {
    return name[0]?.toUpperCase() ?? "?";
  }
  return profile.email?.[0]?.toUpperCase() ?? "?";
}

export function LeaderboardSection({
  leaderboard,
  currentUserId,
  title = "Leaderboard",
  whatCounts,
  emptyMessage = "No scores recorded yet.",
  enableFollowActions = false,
  followingUserIds = [],
}: LeaderboardSectionProps) {
  return (
    <section className='space-y-3'>
      <h2 className='text-foreground text-[17px] font-bold'>{title}</h2>

      {/* What counts, made explicit: metric · reset · who */}
      <div className='bg-card border-border flex items-center gap-2.5 rounded-md border px-3.5 py-2.5'>
        <Info className='text-brand-ink size-4 shrink-0' aria-hidden />
        <p className='text-muted-foreground text-[13px]'>
          Ranked by{" "}
          <span className='text-foreground font-semibold'>
            XP earned this week
          </span>{" "}
          · resets Monday · {whatCounts ?? "everyone on CoachIn"}
        </p>
      </div>

      {leaderboard.length === 0 ? (
        <div className='border-border flex flex-col items-center gap-2.5 rounded-xl border border-dashed px-5 py-8 text-center'>
          <span className='bg-secondary text-muted-foreground grid size-12 place-items-center rounded-full'>
            <Trophy className='size-5' aria-hidden />
          </span>
          <p className='text-muted-foreground max-w-75 text-sm leading-relaxed'>
            {emptyMessage}
          </p>
        </div>
      ) : (
        <div className='flex flex-col gap-1'>
          {leaderboard.map((profile, index) => {
            const isCurrent = profile.id === currentUserId;

            return (
              <div key={profile.id} className='flex items-center'>
                <div className='min-w-0 flex-1'>
                  <LeaderboardRow
                    rank={index + 1}
                    name={profileName(profile)}
                    initials={profileInitials(profile)}
                    xp={profile.xp ?? 0}
                    tier={tierFromLeague(profile.league_tier)}
                    avatarUrl={profile.avatar_url ?? undefined}
                    highlight={isCurrent}
                  />
                </div>
                {enableFollowActions && !isCurrent && (
                  <div className='pl-2'>
                    <FollowToggleButton
                      targetUserId={profile.id}
                      isFollowing={followingUserIds.includes(profile.id)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
