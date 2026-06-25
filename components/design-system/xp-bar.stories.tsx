import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { XpBar } from "./xp-bar";

const meta: Meta<typeof XpBar> = {
  title: "CoachIn/XP Bar",
  component: XpBar,
  parameters: { layout: "centered" },
  args: { level: 7, currentXp: 1840, nextLevelXp: 2200 },
};

export default meta;
type Story = StoryObj<typeof XpBar>;

export const Default: Story = {
  render: (args) => (
    <div className="w-80">
      <XpBar {...args} />
    </div>
  ),
};

export const NearLevelUp: Story = {
  render: () => (
    <div className="w-80">
      <XpBar level={9} currentXp={2980} nextLevelXp={3000} />
    </div>
  ),
};

export const FreshLevel: Story = {
  render: () => (
    <div className="w-80">
      <XpBar level={1} currentXp={40} nextLevelXp={500} />
    </div>
  ),
};
