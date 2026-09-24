import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PageHeader } from "./PageHeader";

const meta: Meta<typeof PageHeader> = {
  title: "Onboarding/PageHeader",
  component: PageHeader,
  args: {
    title: "Plan your week",
    description: "Pick a day, pick a sport, add it. Aim for 3+ days.",
  },
};

export default meta;

type Story = StoryObj<typeof PageHeader>;

export const Default: Story = {};
