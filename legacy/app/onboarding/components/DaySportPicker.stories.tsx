import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { DaySportPicker } from "./DaySportPicker";

const sports = [
  { id: 1, name: "Running" },
  { id: 2, name: "Strength" },
  { id: 3, name: "Swimming" },
  { id: 4, name: "Cycling" },
  { id: 5, name: "Mobility" },
];

const meta: Meta<typeof DaySportPicker> = {
  title: "CoachIn/Onboarding/DaySportPicker",
  component: DaySportPicker,
  parameters: { layout: "padded" },
  args: {
    entryDay: 1,
    sports,
    addAction: () => {},
    onClose: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof DaySportPicker>;

/** Freshly opened for Monday — a sport must be picked before Add enables. */
export const Default: Story = {};

/** Empty grid when no sports have been seeded yet. */
export const NoSports: Story = {
  args: { sports: [] },
};
