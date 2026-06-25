import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CommunityLayout } from "./CommunityLayout";

const meta: Meta<typeof CommunityLayout> = {
  title: "Community/CommunityLayout",
  component: CommunityLayout,
};

export default meta;

type Story = StoryObj<typeof CommunityLayout>;

export const Default: Story = {
  render: () => (
    <CommunityLayout>
      <div className='rounded-xl bg-card text-card-foreground p-6 shadow-sm'>
        Community layout preview
      </div>
    </CommunityLayout>
  ),
};
