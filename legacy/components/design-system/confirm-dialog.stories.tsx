import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { ConfirmDialog } from "./confirm-dialog";
import { Button } from "@/components/ui/button";

const meta: Meta<typeof ConfirmDialog> = {
  title: "CoachIn/Confirm Dialog",
  component: ConfirmDialog,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    title: "Leave Morning Crew?",
    description:
      "You'll drop off the club leaderboard. You can rejoin anytime with a code.",
    confirmLabel: "Leave club",
    onConfirm: fn(),
    onCancel: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ConfirmDialog>;

export const LeaveClub: Story = {};

export const Logout: Story = {
  args: {
    title: "Log out?",
    description:
      "Your streak keeps counting — just come back tomorrow and log a session.",
    confirmLabel: "Log out",
  },
};

export const Pending: Story = {
  args: { pending: true },
};

/** Reversible actions confirm in green — red is reserved for destructive. */
export const ArchiveSuccess: Story = {
  args: {
    title: "Archive this plan?",
    description:
      "Progress is kept, but the plan stops showing on your dashboard. You can generate a new one anytime.",
    confirmLabel: "Archive",
    confirmVariant: "success",
  },
};

function InteractiveDemo() {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="grid min-h-64 place-items-center">
      <Button variant="destructive-outline" onClick={() => setOpen(true)}>
        Leave club
      </Button>
      <ConfirmDialog
        open={open}
        title="Leave Morning Crew?"
        description="You'll drop off the club leaderboard. You can rejoin anytime with a code."
        confirmLabel="Leave club"
        onConfirm={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}

export const Interactive: Story = {
  render: () => <InteractiveDemo />,
};
