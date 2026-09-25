import Link from "next/link";
import { CalendarHeart, ChevronRight, Pencil, type LucideIcon } from "lucide-react";

const LINKS: { href: string; icon: LucideIcon; title: string; subtitle: string }[] = [
  {
    href: "/training",
    icon: CalendarHeart,
    title: "My programs",
    subtitle: "View, add, or archive your training programs",
  },
  { href: "/onboarding", icon: Pencil, title: "Recurring routine", subtitle: "Edit your weekly training schedule" },
];

/** Entry points to programs and the weekly routine. */
export function TrainingLinks() {
  return (
    <div className='bg-card border-border divide-border divide-y rounded-xl border px-4'>
      {LINKS.map(({ href, icon: Icon, title, subtitle }) => (
        <Link key={href} href={href} className='hover:bg-secondary/50 -mx-4 flex items-center gap-3 px-4 py-3'>
          <span className='bg-brand-tint text-brand-ink grid size-9 shrink-0 place-items-center rounded-lg'>
            <Icon className='size-4.5' aria-hidden />
          </span>
          <span className='min-w-0 flex-1'>
            <span className='text-foreground block text-sm font-semibold'>{title}</span>
            <span className='text-muted-foreground block text-xs'>{subtitle}</span>
          </span>
          <ChevronRight className='text-muted-foreground size-4 shrink-0' aria-hidden />
        </Link>
      ))}
    </div>
  );
}
