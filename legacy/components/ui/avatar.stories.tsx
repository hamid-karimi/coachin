import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Avatar, AvatarFallback, AvatarImage } from "./avatar";

const meta: Meta<typeof Avatar> = {
  title: "UI/Avatar",
  component: Avatar,
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof Avatar>;

export const Fallback: Story = {
  render: () => (
    <Avatar>
      <AvatarFallback>SR</AvatarFallback>
    </Avatar>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Avatar className="size-7">
        <AvatarFallback>MK</AvatarFallback>
      </Avatar>
      <Avatar className="size-9">
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
      <Avatar className="size-12">
        <AvatarFallback>AL</AvatarFallback>
      </Avatar>
    </div>
  ),
};

export const WithImage: Story = {
  render: () => (
    <Avatar className="size-12">
      <AvatarImage
        src="https://i.pravatar.cc/96?img=12"
        alt="Sara"
      />
      <AvatarFallback>SR</AvatarFallback>
    </Avatar>
  ),
};
