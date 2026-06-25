import type { ProfileSummary } from "../types";
import { FollowToggleButton } from "./FollowToggleButton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LeaderboardRow } from "@/components/design-system/leaderboard-row";
import type { Tier } from "@/components/design-system/tier-badge";

interface LeaderboardSectionProps {
  leaderboard: ProfileSummary[];
  currentUserId: string;
  title?: string;
  emptyMessage?: string;
  enableFollowActions?: boolean;
  followingUserIds?: string[];
}

const TIERS: readonly Tier[] = ["bronze", "silver", "gold", "platinum"];

/**
 * Map the real `profiles.league_tier` string onto the DS `TierBadge`
 * `Tier` union. Unknown or missing values fall back to `"bronze"`.
 */
function tierFromLeague(leagueTier?: string | null): Tier {
  const normalized = leagueTier?.toLowerCase().trim();
  return TIERS.find((tier) => tier === normalized) ?? "bronze";
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
  title = "Top Performers This Week",
  emptyMessage = "No scores recorded yet.",
  enableFollowActions = false,
  followingUserIds = [],
}: LeaderboardSectionProps) {
  return (
    <Card className='gap-0 overflow-hidden py-0'>
      <CardHeader className='bg-brand-tint py-4'>
        <CardTitle className='text-brand-ink text-lg font-bold'>
          {title}
        </CardTitle>
      </CardHeader>

      {leaderboard.length === 0 ? (
        <CardContent className='py-6 text-sm text-muted-foreground'>
          {emptyMessage}
        </CardContent>
      ) : (
        <div className='divide-y divide-border'>
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
                  <div className='pr-4'>
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
    </Card>
  );
}
