import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Input } from "./input";
import { Label } from "./label";

const meta: Meta<typeof Input> = {
  title: "UI/Input",
  component: Input,
  parameters: { layout: "centered" },
  args: { placeholder: "sara@email.com" },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  render: (args) => (
    <div className="w-72">
      <Input {...args} />
    </div>
  ),
};

export const WithLabel: Story = {
  render: () => (
    <div className="flex w-72 flex-col gap-2">
      <Label htmlFor="email">Email</Label>
      <Input id="email" type="email" placeholder="sara@email.com" />
    </div>
  ),
};

export const Invalid: Story = {
  render: () => (
    <div className="flex w-72 flex-col gap-2">
      <Label htmlFor="pw">Password</Label>
      <Input id="pw" type="password" aria-invalid defaultValue="123" />
      <p className="text-destructive text-xs">
        Password must be at least 8 characters.
      </p>
    </div>
  ),
};
