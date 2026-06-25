import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { LeaderboardRow } from "./leaderboard-row";

const meta: Meta<typeof LeaderboardRow> = {
  title: "CoachIn/Leaderboard Row",
  component: LeaderboardRow,
  parameters: { layout: "centered" },
  args: {
    rank: 1,
    name: "Maya K.",
    initials: "MK",
    xp: 980,
    tier: "gold",
  },
};

export default meta;
type Story = StoryObj<typeof LeaderboardRow>;

export const Default: Story = {
  render: (args) => (
    <div className="w-96 overflow-hidden rounded-lg border border-border">
      <LeaderboardRow {...args} />
    </div>
  ),
};

export const FullBoard: Story = {
  render: () => (
    <div className="w-96 divide-y divide-border overflow-hidden rounded-lg border border-border">
      <LeaderboardRow rank={1} name="Maya K." initials="MK" xp={980} tier="gold" />
      <LeaderboardRow rank={2} name="Jonas D." initials="JD" xp={870} tier="gold" />
      <LeaderboardRow
        rank={14}
        name="You"
        initials="SR"
        xp={640}
        tier="silver"
        highlight
      />
      <LeaderboardRow rank={15} name="Aino L." initials="AL" xp={610} tier="silver" />
    </div>
  ),
};
