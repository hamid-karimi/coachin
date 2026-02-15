import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PageHeader } from "./PageHeader";

const meta: Meta<typeof PageHeader> = {
  title: "Onboarding/PageHeader",
  component: PageHeader,
  args: {
    title: "Weekly Planning 📅",
    description: "Set your recurring workout routine for each day of the week.",
  },
};

export default meta;

type Story = StoryObj<typeof PageHeader>;

export const Default: Story = {};
