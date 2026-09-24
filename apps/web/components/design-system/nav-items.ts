import { CalendarRange, CircleUser, Dumbbell, GraduationCap, Home, Users, UtensilsCrossed, type LucideIcon } from "lucide-react";
import type { NavKey } from "@/lib/nav";

/** Tab order and icons shared by the sidebar and the bottom nav. */
export const NAV_ITEMS: { key: NavKey; label: string; shortLabel: string; icon: LucideIcon }[] = [
  { key: "home", label: "Today", shortLabel: "Today", icon: Home },
  { key: "training", label: "Training", shortLabel: "Training", icon: Dumbbell },
  { key: "calendar", label: "Calendar", shortLabel: "Calendar", icon: CalendarRange },
  { key: "nutrition", label: "Nutrition", shortLabel: "Meals", icon: UtensilsCrossed },
  { key: "community", label: "Community", shortLabel: "Community", icon: Users },
  { key: "coaching", label: "Coaching", shortLabel: "Coaching", icon: GraduationCap },
  { key: "profile", label: "Profile", shortLabel: "Profile", icon: CircleUser },
];
