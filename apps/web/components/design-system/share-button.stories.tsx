import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ShareButton } from "./share-button";
import { dayShareCard, mealShareCard } from "@/lib/share-card";

const meta: Meta<typeof ShareButton> = {
  title: "CoachIn/Share Button",
  component: ShareButton,
  args: { label: "Share today", data: dayShareCard({ kcal: 2140, proteinG: 132, mealsCount: 4 }) },
};

export default meta;
type Story = StoryObj<typeof ShareButton>;

export const WithLabel: Story = {};

export const IconOnly: Story = {
  args: { label: "Share meal", iconOnly: true, data: mealShareCard({ title: "Oat bowl", kcal: 450, proteinG: 20 }) },
};
