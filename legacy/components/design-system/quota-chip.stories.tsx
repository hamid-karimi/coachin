import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { QuotaChip } from "./quota-chip";

const meta: Meta<typeof QuotaChip> = {
  title: "CoachIn/Quota Chip",
  component: QuotaChip,
  args: { name: "Running", done: 1, target: 2 },
};

export default meta;
type Story = StoryObj<typeof QuotaChip>;

export const Unmet: Story = {};

export const Met: Story = {
  args: { done: 2 },
};

export const OverTarget: Story = {
  args: { done: 3 },
};

export const Row: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-1.5">
      <QuotaChip name="Running" done={2} target={2} />
      <QuotaChip name="Strength" done={0} target={2} />
      <QuotaChip name="Yoga" done={1} target={3} />
    </div>
  ),
};
