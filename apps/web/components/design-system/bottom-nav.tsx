import Link from "next/link";
import { isNavVisible, NAV_ROUTES, type NavKey, type NavVisibility } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

interface BottomNavProps extends NavVisibility {
  active: NavKey;
  className?: string;
}

/** Mobile tab bar. */
export function BottomNav({ active, coachNav, communityNav, className }: BottomNavProps) {
  const items = NAV_ITEMS.filter((item) => isNavVisible(item.key, { coachNav, communityNav }));
  return (
    <nav
      className={cn(
        "border-border bg-card/95 flex items-center justify-around border-t px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur",
        className,
      )}
      aria-label='Primary'>
      {items.map(({ key, shortLabel, icon: Icon }) => {
        const isActive = key === active;
        return (
          <Link
            key={key}
            href={NAV_ROUTES[key]}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-w-16 flex-col items-center gap-0.5 rounded-md px-3 py-1 text-[11px] transition-colors",
              isActive ? "text-brand-ink font-bold" : "text-muted-foreground font-semibold",
            )}>
            <Icon className='size-5.5' aria-hidden />
            {shortLabel}
          </Link>
        );
      })}
    </nav>
  );
}
