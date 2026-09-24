import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StreakBadge } from "./streak-badge";

const meta: Meta<typeof StreakBadge> = {
  title: "CoachIn/Streak Badge",
  component: StreakBadge,
  parameters: { layout: "centered" },
  args: { days: 12 },
};

export default meta;
type Story = StoryObj<typeof StreakBadge>;

export const Default: Story = {};

export const Range: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <StreakBadge days={1} />
      <StreakBadge days={7} />
      <StreakBadge days={30} />
      <StreakBadge days={100} />
    </div>
  ),
};

/** Count-only pill for tight headers (dashboard top-right). */
export const Compact: Story = {
  args: { days: 12, compact: true },
};

/** A dead streak renders quiet and gray — never celebratory. */
export const NoStreak: Story = {
  args: { days: 0 },
};
