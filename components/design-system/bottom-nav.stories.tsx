import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { BottomNav } from "./bottom-nav";

const meta: Meta<typeof BottomNav> = {
  title: "CoachIn/Bottom Nav",
  component: BottomNav,
  parameters: { layout: "fullscreen" },
  args: { active: "home", onNavigate: fn() },
  argTypes: {
    active: {
      control: "inline-radio",
      options: ["home", "plan", "community", "profile"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof BottomNav>;

export const Default: Story = {
  render: (args) => (
    <div className="mx-auto w-80 overflow-hidden rounded-xl border border-border">
      <BottomNav {...args} />
    </div>
  ),
};

export const CommunityActive: Story = {
  render: () => (
    <div className="mx-auto w-80 overflow-hidden rounded-xl border border-border">
      <BottomNav active="community" onNavigate={fn()} />
    </div>
  ),
};
