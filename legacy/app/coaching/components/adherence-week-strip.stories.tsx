import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AdherenceWeekStrip } from "./AdherenceWeekStrip";

/** Monday of the current week (local time), matching the app's convention. */
function currentMonday(): Date {
  const today = new Date();
  const mondayOffset = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);
  return monday;
}

function localDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayOffset(offset: number): string {
  const date = currentMonday();
  date.setDate(date.getDate() + offset);
  return localDate(date);
}

const weekStart = localDate(currentMonday());

const meta: Meta<typeof AdherenceWeekStrip> = {
  title: "Coaching/Adherence Week Strip",
  component: AdherenceWeekStrip,
  parameters: { layout: "centered" },
  args: {
    weekStart,
    scheduledDays: [1, 3, 5],
    loggedDates: [dayOffset(0)],
  },
};

export default meta;
type Story = StoryObj<typeof AdherenceWeekStrip>;

/** Monday logged; Wednesday/Friday planned; the rest are rest days. */
export const Default: Story = {};

/** Every scheduled day this week already logged. */
export const PerfectWeek: Story = {
  args: {
    scheduledDays: [1, 2, 3, 4, 5],
    loggedDates: [dayOffset(0), dayOffset(1), dayOffset(2), dayOffset(3), dayOffset(4)],
  },
};

/** Sessions scheduled but nothing logged — past days render as missed. */
export const NothingLogged: Story = {
  args: { scheduledDays: [1, 2, 3, 4, 5, 6, 0], loggedDates: [] },
};

/** No schedule at all — a full row of rest dots. */
export const NoSchedule: Story = {
  args: { scheduledDays: [], loggedDates: [] },
};
