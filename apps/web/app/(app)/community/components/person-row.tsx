import type { ReactNode } from "react";
import { TierBadge, type Tier } from "@/components/design-system/tier-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/app/(app)/dashboard/lib/today";

interface PersonRowProps {
  name: string;
  avatarUrl?: string | null;
  /** Omitted where the tier isn't known (group members). */
  tier?: string;
  subtitle: string;
  /** Right-side action (follow toggle). */
  children?: ReactNode;
}

/** Someone in the community: avatar, name, tier, a detail line, an action. */
export function PersonRow({ name, avatarUrl, tier, subtitle, children }: PersonRowProps) {
  return (
    <li className='bg-secondary flex items-center justify-between gap-3 rounded-lg p-3'>
      <div className='flex min-w-0 items-center gap-3'>
        <Avatar className='size-9'>
          {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>
        <div className='min-w-0'>
          <p className='text-foreground flex items-center gap-2 truncate text-sm font-semibold'>
            {name}
            {tier ? <TierBadge tier={tier as Tier} /> : null}
          </p>
          <p className='text-muted-foreground text-xs'>{subtitle}</p>
        </div>
      </div>
      {children}
    </li>
  );
}
