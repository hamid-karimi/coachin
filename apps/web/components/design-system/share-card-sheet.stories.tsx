import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { ShareCardSheet } from "./share-card-sheet";
import { dayShareCard, mealShareCard, sessionShareCard } from "@/lib/share-card";

const meta: Meta<typeof ShareCardSheet> = {
  title: "CoachIn/Share Card Sheet",
  component: ShareCardSheet,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    onClose: fn(),
    data: sessionShareCard({
      title: "Upper body — Day A",
      totalVolumeKg: 1540,
      exercises: [
        {
          name: "Goblet squat",
          sets: [
            { weight_kg: 20, reps: 10 },
            { weight_kg: 20, reps: 10 },
          ],
        },
        { name: "Floor press", sets: [{ weight_kg: 15, reps: 12 }] },
      ],
    }),
  },
};

export default meta;
type Story = StoryObj<typeof ShareCardSheet>;

export const StrengthSession: Story = {};

export const Meal: Story = {
  args: { data: mealShareCard({ title: "Ghormeh sabzi with rice", kcal: 620, proteinG: 32 }) },
};

export const DayOfEating: Story = {
  args: { data: dayShareCard({ kcal: 2140, proteinG: 132, mealsCount: 4 }) },
};
