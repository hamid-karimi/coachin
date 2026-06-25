import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Flame, Trophy, Footprints } from "lucide-react";

import { Badge } from "./badge";

const meta: Meta<typeof Badge> = {
  title: "UI/Badge",
  component: Badge,
  args: { children: "Badge" },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "brand", "xp", "flame", "secondary", "outline", "destructive"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {};
export const Brand: Story = { args: { variant: "brand", children: "Gold league" } };

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="xp">
        <Trophy /> Gold league
      </Badge>
      <Badge variant="flame">
        <Flame /> 12-day streak
      </Badge>
      <Badge variant="brand">
        <Footprints /> Running
      </Badge>
      <Badge variant="secondary">Silver</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="destructive">Missed</Badge>
    </div>
  ),
};
