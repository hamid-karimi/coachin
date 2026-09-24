import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { BottomNav } from "./bottom-nav";

const meta: Meta<typeof BottomNav> = {
  title: "CoachIn/Bottom Nav",
  component: BottomNav,
  parameters: { layout: "fullscreen" },
  args: { active: "home", coachNav: false, communityNav: false },
  argTypes: {
    active: {
      control: "inline-radio",
      options: ["home", "training", "calendar", "nutrition", "community", "coaching", "profile"],
    },
  },
  decorators: [
    (Story) => (
      <div className="border-border mx-auto w-96 overflow-hidden rounded-xl border">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof BottomNav>;

export const Default: Story = {};

export const CommunityActive: Story = {
  args: { active: "community", communityNav: true },
};

export const CoachNav: Story = {
  args: { active: "coaching", coachNav: true },
};
