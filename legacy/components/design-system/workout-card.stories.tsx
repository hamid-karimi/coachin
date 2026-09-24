import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { WorkoutCard } from "./workout-card";

const meta: Meta<typeof WorkoutCard> = {
  title: "CoachIn/Workout Card",
  component: WorkoutCard,
  parameters: { layout: "centered" },
  args: {
    sport: "running",
    time: "07:00",
    xp: 80,
    status: "pending",
    onLog: fn(),
  },
  argTypes: {
    sport: {
      control: "select",
      options: ["running", "strength", "swimming", "cycling", "mobility"],
    },
    status: { control: "inline-radio", options: ["pending", "done"] },
  },
};

export default meta;
type Story = StoryObj<typeof WorkoutCard>;

export const Pending: Story = {
  render: (args) => (
    <div className="w-80">
      <WorkoutCard {...args} />
    </div>
  ),
};

export const Done: Story = {
  render: () => (
    <div className="w-80">
      <WorkoutCard sport="mobility" xp={40} status="done" />
    </div>
  ),
};

export const PlanList: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-2.5">
      <WorkoutCard sport="running" time="07:00" xp={80} onLog={fn()} />
      <WorkoutCard sport="strength" time="18:30" xp={120} onLog={fn()} />
      <WorkoutCard sport="mobility" xp={40} status="done" />
    </div>
  ),
};
