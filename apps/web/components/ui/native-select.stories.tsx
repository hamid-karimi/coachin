import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Label } from "./label";
import { NativeSelect } from "./native-select";

const meta: Meta<typeof NativeSelect> = {
  title: "UI/NativeSelect",
  component: NativeSelect,
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof NativeSelect>;

export const WithLabel: Story = {
  render: () => (
    <div className='flex w-72 flex-col gap-2'>
      <Label htmlFor='sex'>Sex</Label>
      <NativeSelect id='sex' defaultValue=''>
        <option value=''>Prefer not to say</option>
        <option value='male'>Male</option>
        <option value='female'>Female</option>
        <option value='other'>Other</option>
      </NativeSelect>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <NativeSelect disabled className='w-72'>
      <option>Pick a metric</option>
    </NativeSelect>
  ),
};
