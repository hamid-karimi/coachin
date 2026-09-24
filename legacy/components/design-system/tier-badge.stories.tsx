import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { TierBadge } from "./tier-badge";

const meta: Meta<typeof TierBadge> = {
  title: "CoachIn/Tier Badge",
  component: TierBadge,
  parameters: { layout: "centered" },
  args: { tier: "gold" },
  argTypes: {
    tier: {
      control: "select",
      options: ["bronze", "silver", "gold", "platinum"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof TierBadge>;

export const Default: Story = {};

export const AllTiers: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <TierBadge tier="bronze" />
      <TierBadge tier="silver" />
      <TierBadge tier="gold" />
      <TierBadge tier="platinum" />
    </div>
  ),
};
