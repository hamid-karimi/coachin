import Link from "next/link";
import type { ComponentType } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface EntryCardProps {
  href: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  /** Icon tile colors. */
  tone?: "brand" | "flame";
}

const TONES = {
  brand: "bg-brand-tint text-brand-ink",
  flame: "bg-flame-tint text-flame-ink",
};

/** A tappable card that leads to another surface. */
export function EntryCard({ href, icon: Icon, title, subtitle, tone = "brand" }: EntryCardProps) {
  return (
    <Link
      href={href}
      className='bg-card border-border hover:border-brand/40 group flex items-center gap-3.5 rounded-2xl border p-4 transition-colors'>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", TONES[tone])}>
        <Icon className='size-5' aria-hidden />
      </span>
      <span className='min-w-0 flex-1'>
        <span className='text-foreground block text-sm font-semibold'>{title}</span>
        <span className='text-muted-foreground block text-[13px]'>{subtitle}</span>
      </span>
      <ChevronRight
        className='text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-colors'
        aria-hidden
      />
    </Link>
  );
}
