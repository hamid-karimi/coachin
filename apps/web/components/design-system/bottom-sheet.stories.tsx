import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { BottomSheet } from "./bottom-sheet";
import { Button } from "@/components/ui/button";

const meta: Meta<typeof BottomSheet> = {
  title: "CoachIn/Bottom Sheet",
  component: BottomSheet,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    title: "Easy run",
    description: "From your AI plan · edit it in Plan",
    onClose: fn(),
    children: (
      <dl className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground text-sm">Type</dt>
          <dd className="text-foreground text-sm font-semibold">Run</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground text-sm">Day</dt>
          <dd className="text-foreground text-sm font-semibold">Thursday</dd>
        </div>
      </dl>
    ),
  },
};

export default meta;
type Story = StoryObj<typeof BottomSheet>;

export const Default: Story = {};

export const LongTitle: Story = {
  args: {
    title: "Long tempo intervals with strides and cooldown jog",
  },
};

function InteractiveDemo() {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="grid min-h-64 place-items-center">
      <Button variant="brand" onClick={() => setOpen(true)}>
        Open sheet
      </Button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Easy run"
        description="From your AI plan · edit it in Plan"
      >
        <p className="text-muted-foreground text-sm">
          A bottom sheet on mobile, a centered dialog on larger screens.
        </p>
      </BottomSheet>
    </div>
  );
}

export const Interactive: Story = {
  render: () => <InteractiveDemo />,
};
