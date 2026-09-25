import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AdherenceWeekStrip, type AdherenceDay, type AdherenceState } from "./adherence-week-strip";

const week = (states: AdherenceState[]): AdherenceDay[] =>
  states.map((state, i) => ({ date: `2026-09-${21 + i}`, weekday: (i + 1) % 7, state }));

const meta: Meta<typeof AdherenceWeekStrip> = {
  title: "Design System/AdherenceWeekStrip",
  component: AdherenceWeekStrip,
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof AdherenceWeekStrip>;

export const MidWeek: Story = {
  args: { days: week(["done", "rest", "missed", "planned_today", "rest", "planned", "rest"]) },
};

export const PerfectWeek: Story = {
  args: { days: week(["done", "rest", "done", "rest", "done", "rest", "done"]) },
};

export const AllRest: Story = {
  args: { days: week(["rest", "rest", "rest", "rest", "rest", "rest", "rest"]) },
};
