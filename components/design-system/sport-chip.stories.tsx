import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { SportChip, SportIcon } from "./sport-chip";

const meta: Meta<typeof SportChip> = {
  title: "CoachIn/Sport Chip",
  component: SportChip,
  parameters: { layout: "centered" },
  args: { sport: "running" },
  argTypes: {
    sport: {
      control: "select",
      options: ["running", "strength", "swimming", "cycling", "mobility"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof SportChip>;

export const Default: Story = {};

export const AllSports: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <SportChip sport="running" />
      <SportChip sport="strength" />
      <SportChip sport="swimming" />
      <SportChip sport="cycling" />
      <SportChip sport="mobility" />
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
    <div className="flex flex-wrap gap-3">
      <SportIcon sport="running" />
      <SportIcon sport="strength" />
      <SportIcon sport="swimming" />
      <SportIcon sport="cycling" />
      <SportIcon sport="mobility" />
    </div>
  ),
};
