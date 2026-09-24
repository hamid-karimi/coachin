import type { components } from "@/lib/api/schema";

export type HypertrophyBody = components["schemas"]["HypertrophyPlanInputBody"];
export type HypertrophyDraft = Omit<HypertrophyBody, "targetStudentId">;

export const INITIAL_HYPERTROPHY_DRAFT: HypertrophyDraft = {
  goal: "muscle_gain",
  experienceLevel: "recreational",
  equipment: "gym",
  daysPerWeek: 3,
  weeksTotal: 10,
  injuries: "",
};

export const HYPERTROPHY_OPTIONS = {
  goal: [
    ["muscle_gain", "Build muscle"],
    ["recomp", "Recomposition (muscle up, fat down)"],
  ],
  experienceLevel: [
    ["new", "New to lifting"],
    ["recreational", "Some experience"],
    ["regular", "Consistent for 1+ years"],
    ["competitive", "Advanced"],
  ],
  equipment: [
    ["gym", "Full gym"],
    ["home", "Home (dumbbells/bands)"],
    ["bodyweight", "Bodyweight only"],
  ],
  daysPerWeek: [2, 3, 4, 5, 6].map((d) => [d, String(d)]),
  weeksTotal: [8, 10, 12].map((w) => [w, `${w} weeks`]),
} as const;
