import Link from "next/link";
import { isNavVisible, NAV_ROUTES, type NavKey, type NavVisibility } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";
import { ThemeToggle } from "./theme-toggle";

interface AppSidebarProps extends NavVisibility {
  active: NavKey;
  className?: string;
}

/** Desktop navigation rail. */
export function AppSidebar({ active, coachNav, communityNav, className }: AppSidebarProps) {
  const items = NAV_ITEMS.filter((item) => isNavVisible(item.key, { coachNav, communityNav }));
  return (
    <aside
      className={cn(
        // Sticky + h-dvh: fills one viewport and stays put while pages scroll.
        "border-border bg-card sticky top-0 hidden h-dvh gap-1.5 overflow-y-auto border-r p-4 md:flex md:w-[220px] md:shrink-0 md:flex-col",
        className,
      )}>
      <Link href={NAV_ROUTES.home} className='mb-5 flex items-center gap-2.5 px-2 pt-1'>
        <span className='bg-brand text-brand-foreground text-stat grid size-8 place-items-center rounded-sm text-lg font-bold'>
          C
        </span>
        <span className='text-foreground font-display text-base font-bold'>CoachIn</span>
      </Link>

      <nav className='flex flex-col gap-1' aria-label='Primary'>
        {items.map(({ key, label, icon: Icon }) => {
          const isActive = key === active;
          return (
            <Link
              key={key}
              href={NAV_ROUTES[key]}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                isActive
                  ? "bg-brand-tint text-brand-ink font-bold"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground font-semibold",
              )}>
              <Icon className='size-5' aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className='mt-auto flex items-center justify-between px-2 pb-1'>
        <span className='text-muted-foreground text-xs'>Theme</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
