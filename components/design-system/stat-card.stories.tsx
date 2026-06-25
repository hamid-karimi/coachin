import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Flame } from "lucide-react";

import { StatCard } from "./stat-card";

const meta: Meta<typeof StatCard> = {
  title: "CoachIn/Stat Card",
  component: StatCard,
  parameters: { layout: "centered" },
  args: { label: "Weekly XP", value: 640 },
};

export default meta;
type Story = StoryObj<typeof StatCard>;

export const Default: Story = {
  render: (args) => (
    <div className="w-44">
      <StatCard {...args} />
    </div>
  ),
};

export const Row: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-3">
      <StatCard
        label="Streak"
        value="12d"
        accent="flame"
        icon={<Flame className="size-4" aria-hidden />}
      />
      <StatCard label="Global rank" value="#34" />
      <StatCard label="Weekly XP" value={640} accent="xp" />
    </div>
  ),
};
