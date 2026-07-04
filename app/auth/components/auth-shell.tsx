import { ReactNode } from "react";
import { Flame } from "lucide-react";
import { ThemeToggle } from "@/components/design-system/theme-toggle";

interface AuthShellProps {
  children: ReactNode;
}

/** Volt logo tile — the brand mark. */
function LogoTile({ className = "size-12 rounded-lg text-2xl" }: { className?: string }) {
  return (
    <span
      className={`bg-brand text-brand-foreground grid place-items-center font-bold text-stat ${className}`}
      aria-hidden
    >
      C
    </span>
  );
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="bg-background relative flex min-h-screen">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      {/* Desktop brand panel */}
      <aside className="bg-card border-border hidden flex-col justify-between border-r p-14 md:flex md:w-[46%]">
        <div className="flex items-center gap-3">
          <LogoTile className="size-10 rounded-md text-xl" />
          <span className="text-foreground font-display text-lg font-bold">
            CoachIn
          </span>
        </div>

        <div>
          <h2 className="text-foreground font-display text-[44px] leading-[1.1] font-bold tracking-tight">
            Consistency,
            <br />
            gamified.
          </h2>
          <p className="text-muted-foreground mt-4 max-w-sm leading-relaxed">
            Build your week, log workouts in one tap, earn XP, and keep the
            flame alive.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <span className="border-flame/40 bg-flame-tint inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2">
              <Flame className="text-flame fill-flame/30 size-4" aria-hidden />
              <span className="text-foreground text-stat text-sm">12</span>
            </span>
            <span className="bg-xp-tint text-xp-ink rounded-full px-3.5 py-2 text-[13px] font-bold text-stat">
              +120 XP
            </span>
            <span className="bg-tier-gold-tint text-tier-gold rounded-full px-3.5 py-2 text-xs font-bold tracking-[0.05em] uppercase">
              Gold
            </span>
          </div>
        </div>

        <p className="text-muted-foreground text-sm">
          © {new Date().getFullYear()} CoachIn
        </p>
      </aside>

      {/* Form column */}
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 md:hidden">
            <LogoTile />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
