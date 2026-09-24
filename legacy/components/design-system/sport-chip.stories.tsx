import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { SportChip, SportIcon, type Sport } from "./sport-chip";

const ALL_SPORTS: Sport[] = [
  "running",
  "strength",
  "swimming",
  "cycling",
  "mobility",
  "ball_sports",
  "combat",
  "climbing",
  "outdoor",
  "rowing",
  "dance",
];

const meta: Meta<typeof SportChip> = {
  title: "CoachIn/Sport Chip",
  component: SportChip,
  parameters: { layout: "centered" },
  args: { sport: "running" },
  argTypes: {
    sport: {
      control: "select",
      options: ALL_SPORTS,
    },
  },
};

export default meta;
type Story = StoryObj<typeof SportChip>;

export const Default: Story = {};

export const AllSports: Story = {
  render: () => (
    <div className="flex max-w-md flex-wrap gap-2">
      {ALL_SPORTS.map((sport) => (
        <SportChip key={sport} sport={sport} />
      ))}
    </div>
  ),
};

/**
 * Several concrete sport names share one category icon (Football, Tennis, … →
 * ball_sports) — the `label` prop keeps them distinguishable.
 */
export const LabelledCategories: Story = {
  render: () => (
    <div className="flex max-w-md flex-wrap gap-2">
      <SportChip sport="ball_sports" label="Football" />
      <SportChip sport="ball_sports" label="Table tennis" />
      <SportChip sport="combat" label="Boxing" />
      <SportChip sport="combat" label="Martial arts" />
      <SportChip sport="climbing" label="Climbing" />
      <SportChip sport="outdoor" label="Hiking" />
      <SportChip sport="rowing" label="Rowing" />
      <SportChip sport="dance" label="Dance" />
    </div>
  ),
};

/** The XP multiplier lives on the chip so the math is legible. Boosted sports read volt. */
export const WithMultiplier: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <SportChip sport="running" multiplier={1.2} />
      <SportChip sport="strength" multiplier={1.0} />
      <SportChip sport="swimming" multiplier={1.5} />
      <SportChip sport="cycling" multiplier={1.2} />
      <SportChip sport="mobility" multiplier={0.8} />
    </div>
  ),
};

export const Selected: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <SportChip sport="swimming" multiplier={1.5} selected />
      <SportChip sport="running" multiplier={1.2} />
    </div>
  ),
};

export const Icons: Story = {
  render: () => (
    <div className="flex max-w-md flex-wrap gap-3">
      {ALL_SPORTS.map((sport) => (
        <SportIcon key={sport} sport={sport} />
      ))}
    </div>
  ),
};
