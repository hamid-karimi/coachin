import type { Metadata } from "next";
import { ComingSoon } from "../components/coming-soon";

export const metadata: Metadata = { title: "Nutrition · CoachIn" };

export default function NutritionPage() {
  return (
    <ComingSoon
      title='Nutrition'
      greeting='Meals, targets, and trends'
      next='Meal logging by search or photo arrives here with the nutrition module.'
    />
  );
}
