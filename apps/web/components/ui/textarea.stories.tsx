import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Label } from "./label";
import { Textarea } from "./textarea";

const meta: Meta<typeof Textarea> = {
  title: "UI/Textarea",
  component: Textarea,
  parameters: { layout: "centered" },
  args: { placeholder: "How did it feel? Any pain?", rows: 2 },
};

export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = {
  render: (args) => (
    <div className='w-72'>
      <Textarea {...args} />
    </div>
  ),
};

export const WithLabel: Story = {
  render: () => (
    <div className='flex w-72 flex-col gap-2'>
      <Label htmlFor='note'>Note (optional)</Label>
      <Textarea id='note' rows={2} maxLength={500} placeholder='How did it feel? Any pain?' />
    </div>
  ),
};
