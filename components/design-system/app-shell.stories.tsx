import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AppShell } from "./app-shell";

const meta: Meta<typeof AppShell> = {
  title: "CoachIn/App Shell",
  component: AppShell,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/dashboard" },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AppShell>;

export const Default: Story = {
  render: () => (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-brand-ink">Dashboard</h1>
        <p className="text-muted-foreground">
          Placeholder content rendered inside the authenticated app shell. The
          sidebar shows on desktop; the bottom nav shows on mobile.
        </p>
        <div className="rounded-xl border border-border bg-card p-6">
          Today&apos;s plan goes here.
        </div>
      </div>
    </AppShell>
  ),
};

export const CoachNav: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/coaching" },
    },
  },
  render: () => (
    <AppShell coachNav>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-brand-ink">Coaching</h1>
        <p className="text-muted-foreground">
          Coach-enabled viewers get a fifth Coaching nav item on both
          breakpoints.
        </p>
      </div>
    </AppShell>
  ),
};

export const CommunityActive: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/community" },
    },
  },
  render: () => (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-brand-ink">Community</h1>
        <p className="text-muted-foreground">
          The Community nav item is active on both breakpoints.
        </p>
      </div>
    </AppShell>
  ),
};
