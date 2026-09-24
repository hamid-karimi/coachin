import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { LeaderboardRow } from "./leaderboard-row";

const meta: Meta<typeof LeaderboardRow> = {
  title: "CoachIn/Leaderboard Row",
  component: LeaderboardRow,
  parameters: { layout: "centered" },
  args: {
    rank: 1,
    name: "Jonas T.",
    initials: "JT",
    xp: 2180,
    tier: "gold",
  },
};

export default meta;
type Story = StoryObj<typeof LeaderboardRow>;

export const Default: Story = {
  render: (args) => (
    <div className="border-border w-100 overflow-hidden rounded-lg border">
      <LeaderboardRow {...args} />
    </div>
  ),
};

/** Ranks 1–3 get medals; the current user gets the volt YOU treatment. */
export const FullBoard: Story = {
  render: () => (
    <div className="flex w-100 flex-col gap-1">
      <LeaderboardRow rank={1} name="Jonas T." initials="JT" xp={2180} tier="gold" />
      <LeaderboardRow rank={2} name="Ana S." initials="AS" xp={1940} tier="silver" />
      <LeaderboardRow rank={3} name="Ravi D." initials="RD" xp={1610} tier="gold" />
      <LeaderboardRow
        rank={4}
        name="Maya K."
        initials="MK"
        xp={1240}
        tier="gold"
        highlight
        subtitle="↑ 2 since last week · 370 XP to #3"
      />
      <LeaderboardRow rank={5} name="Lena B." initials="LB" xp={1105} tier="bronze" />
    </div>
  ),
};

export const YouRow: Story = {
  args: {
    rank: 14,
    name: "Maya K.",
    initials: "MK",
    xp: 640,
    tier: "silver",
    highlight: true,
    subtitle: "↑ 2 since last week",
  },
  render: (args) => (
    <div className="w-100">
      <LeaderboardRow {...args} />
    </div>
  ),
};
