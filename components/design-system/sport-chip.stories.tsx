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
