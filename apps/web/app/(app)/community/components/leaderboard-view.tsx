"use client";

import Link from "next/link";
import { LeaderboardRow } from "@/components/design-system/leaderboard-row";
import type { Tier } from "@/components/design-system/tier-badge";
import { cn } from "@/lib/utils";
import { initials } from "@/app/(app)/dashboard/lib/today";
import { useLeaderboard } from "../hooks/use-community";
import { BOARDS, boardCopy, boardHref, type Board } from "../lib/community";

/** Board pills and the ranked board. */
export function LeaderboardView({ board }: { board: Board }) {
  const lb = useLeaderboard(board);
  const copy = boardCopy(lb);
  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap gap-2'>
        {BOARDS.map((item) => (
          <Link
            key={item.key}
            href={boardHref(item.key)}
            aria-current={item.key === board ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
              item.key === board
                ? "bg-brand text-brand-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}>
            {item.label}
          </Link>
        ))}
      </div>
      <section className='bg-card border-border space-y-1 rounded-xl border py-3'>
        <div className='px-4 pb-2'>
          <h2 className='text-foreground text-[17px] font-bold'>{copy.title}</h2>
          <p className='text-muted-foreground text-xs'>{copy.rules}</p>
        </div>
        {lb.rows.length === 0 ? (
          <p className='text-muted-foreground px-4 pb-2 text-sm'>{copy.empty}</p>
        ) : (
          lb.rows.map((row) => (
            <LeaderboardRow
              key={row.userId}
              rank={row.rank}
              name={row.name}
              initials={initials(row.name)}
              xp={row.xp}
              tier={row.tier as Tier}
              avatarUrl={row.avatarUrl ?? undefined}
              highlight={row.isYou}
              subtitle={`Level ${row.level}`}
            />
          ))
        )}
      </section>
    </div>
  );
}
