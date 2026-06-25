import { ReactNode } from "react";
import { CalendarCheck, Trophy, Users, Zap } from "lucide-react";
import { ThemeToggle } from "@/components/design-system/theme-toggle";

interface AuthShellProps {
  children: ReactNode;
}

const features = [
  {
    icon: CalendarCheck,
    title: "Plan your week",
    description: "Build a weekly training schedule across every sport.",
  },
  {
    icon: Zap,
    title: "Earn XP for every session",
    description: "Log workouts, gain XP, and level up as you go.",
  },
  {
    icon: Trophy,
    title: "Climb the leaderboards",
    description: "Compete with your club and your circle.",
  },
  {
    icon: Users,
    title: "Train with your community",
    description: "Connect with coaches, clubs, and friends.",
  },
];

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="relative min-h-screen bg-background flex">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      {/* Desktop brand panel */}
      <aside className="hidden md:flex md:w-[46%] flex-col justify-between bg-brand text-brand-foreground p-12">
        <div>
          <span className="text-2xl font-bold tracking-tight">CoachIn</span>
          <p className="mt-4 max-w-sm text-lg text-brand-foreground/90">
            Your training, gamified. Plan, log, and level up — together.
          </p>
        </div>

        <ul className="space-y-6">
          {features.map(({ icon: Icon, title, description }) => (
            <li key={title} className="flex items-start gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-foreground/15">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-medium">{title}</p>
                <p className="text-sm text-brand-foreground/80">{description}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="text-sm text-brand-foreground/70">
          © {new Date().getFullYear()} CoachIn
        </p>
      </aside>

      {/* Form column */}
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
