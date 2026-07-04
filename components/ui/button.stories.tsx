import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Check, Plus } from "lucide-react";

import { Button } from "./button";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  args: { children: "Log workout" },
  argTypes: {
    variant: {
      control: "select",
      options: [
        "brand",
        "default",
        "secondary",
        "outline",
        "ghost",
        "destructive",
        "destructive-outline",
        "link",
      ],
    },
    size: { control: "select", options: ["default", "sm", "lg", "icon"] },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Brand: Story = { args: { variant: "brand" } };
export const Secondary: Story = {
  args: { variant: "secondary", children: "Skip today" },
};
export const Outline: Story = {
  args: { variant: "outline", children: "View plan" },
};
export const Ghost: Story = { args: { variant: "ghost", children: "Cancel" } };
export const Destructive: Story = {
  args: { variant: "destructive", children: "Delete session" },
};

/** Destructive stays outline until the confirm dialog; solid red lives there. */
export const DestructiveOutline: Story = {
  args: { variant: "destructive-outline", children: "Leave club" },
};

export const WithIcon: Story = {
  render: () => (
    <Button variant="brand">
      <Check />
      Log
    </Button>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon" aria-label="Add">
        <Plus />
      </Button>
    </div>
  ),
};
