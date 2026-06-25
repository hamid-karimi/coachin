import type { Meta, StoryObj } from "@storybook/nextjs-vite";

const meta: Meta = {
  title: "Design System/Typography",
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj;

export const Scale: Story = {
  render: () => (
    <div className="text-foreground flex max-w-xl flex-col gap-4">
      <div>
        <p className="text-[22px] font-medium">Display · 22 / 500</p>
        <p className="text-muted-foreground text-xs">Greetings, page titles</p>
      </div>
      <div>
        <p className="text-lg font-medium">Heading · 18 / 500</p>
        <p className="text-muted-foreground text-xs">Section headers</p>
      </div>
      <div>
        <p className="text-base font-medium">Subheading · 16 / 500</p>
        <p className="text-muted-foreground text-xs">Card titles</p>
      </div>
      <div>
        <p className="text-base">Body · 16 / 400 — log a workout to earn XP.</p>
        <p className="text-muted-foreground text-xs">Default copy</p>
      </div>
      <div>
        <p className="text-[13px]">Caption · 13 / 400 — 3 of 5 sessions done</p>
        <p className="text-muted-foreground text-xs">Metadata, hints</p>
      </div>
    </div>
  ),
};

export const Weights: Story = {
  render: () => (
    <div className="text-foreground flex flex-col gap-2">
      <p className="text-base font-normal">Regular · weight 400</p>
      <p className="text-base font-medium">Medium · weight 500</p>
    </div>
  ),
};
