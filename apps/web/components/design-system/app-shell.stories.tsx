import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AppShell } from "./app-shell";

const meta: Meta<typeof AppShell> = {
  title: "CoachIn/App Shell",
  component: AppShell,
  args: { coachNav: false, communityNav: false },
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true, navigation: { pathname: "/dashboard" } },
  },
};

export default meta;
type Story = StoryObj<typeof AppShell>;

export const Default: Story = {
  render: (args) => (
    <AppShell {...args}>
      <div className="space-y-4">
        <h1 className="text-brand-ink text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Placeholder content inside the signed-in shell. The sidebar shows on desktop; the bottom nav on mobile.
        </p>
        <div className="border-border bg-card rounded-xl border p-6">Today&apos;s plan goes here.</div>
      </div>
    </AppShell>
  ),
};

export const CoachNav: Story = {
  args: { coachNav: true },
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: "/coaching" } } },
  render: (args) => (
    <AppShell {...args}>
      <h1 className="text-brand-ink text-2xl font-bold">Coaching</h1>
    </AppShell>
  ),
};

export const CommunityActive: Story = {
  args: { communityNav: true },
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: "/community" } } },
  render: (args) => (
    <AppShell {...args}>
      <h1 className="text-brand-ink text-2xl font-bold">Community</h1>
    </AppShell>
  ),
};
