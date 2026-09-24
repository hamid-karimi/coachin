import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Flame } from "lucide-react";

import { StatCard } from "./stat-card";

const meta: Meta<typeof StatCard> = {
  title: "CoachIn/Stat Card",
  component: StatCard,
  parameters: { layout: "centered" },
  args: { label: "Total XP", value: "6,680" },
  argTypes: {
    accent: {
      control: "select",
      options: ["default", "brand", "xp", "flame", "gold"],
    },
  },
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

/** The dashboard's desktop stat row: Level · Streak · Total XP · League. */
export const Row: Story = {
  render: () => (
    <div className="grid grid-cols-4 gap-3">
      <StatCard label="Level" value={7} accent="brand" />
      <StatCard
        label="Streak"
        value={12}
        icon={<Flame className="text-flame fill-flame/30 size-4.5" aria-hidden />}
      />
      <StatCard label="Total XP" value="6,680" />
      <StatCard label="League" value="Gold" accent="gold" />
    </div>
  ),
};

export const Accents: Story = {
  render: () => (
    <div className="grid grid-cols-5 gap-3">
      <StatCard label="Default" value="148" />
      <StatCard label="Brand" value="7" accent="brand" />
      <StatCard label="XP" value="640" accent="xp" />
      <StatCard label="Flame" value="12" accent="flame" />
      <StatCard label="Gold" value="Gold" accent="gold" />
    </div>
  ),
};
