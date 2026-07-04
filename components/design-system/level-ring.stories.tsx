import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { LevelRing } from "./level-ring";

const meta: Meta<typeof LevelRing> = {
  title: "CoachIn/Level Ring",
  component: LevelRing,
  parameters: { layout: "centered" },
  args: { level: 7, progress: 68, size: "md" },
  argTypes: {
    progress: { control: { type: "range", min: 0, max: 100 } },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
  },
};

export default meta;
type Story = StoryObj<typeof LevelRing>;

export const Default: Story = {};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <LevelRing level={7} progress={68} size="sm" />
      <LevelRing level={7} progress={68} size="md" />
      <LevelRing level={7} progress={68} size="lg" />
    </div>
  ),
};

export const Progression: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <LevelRing level={1} progress={4} />
      <LevelRing level={5} progress={35} />
      <LevelRing level={9} progress={86} />
      <LevelRing level={12} progress={99} />
    </div>
  ),
};
