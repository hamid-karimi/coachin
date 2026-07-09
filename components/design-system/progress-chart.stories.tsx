import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { TrendLineChart, WeeklyBarsChart } from "./progress-chart";

const meta: Meta = {
  title: "Design System/ProgressChart",
};
export default meta;

const weeks = [
  { label: "May 18", value: 0 },
  { label: "May 25", value: 3200 },
  { label: "Jun 1", value: 4100 },
  { label: "Jun 8", value: 0 },
  { label: "Jun 15", value: 4650 },
  { label: "Jun 22", value: 5200 },
  { label: "Jun 29", value: 4900 },
  { label: "Jul 6", value: 6100 },
];

export const VolumeBars: StoryObj = {
  render: () => (
    <div className="max-w-md">
      <WeeklyBarsChart title="Weekly volume" unit="kg" points={weeks} />
    </div>
  ),
};

export const KmBarsSparse: StoryObj = {
  render: () => (
    <div className="max-w-md">
      <WeeklyBarsChart
        title="Weekly running"
        unit="km"
        points={weeks.map((week) => ({ ...week, value: week.value / 250 }))}
      />
    </div>
  ),
};

export const WeightTrend: StoryObj = {
  render: () => (
    <div className="max-w-md">
      <TrendLineChart
        title="Body weight"
        unit="kg"
        points={[
          { label: "May 1", value: 86.2 },
          { label: "May 15", value: 85.4 },
          { label: "Jun 1", value: 85.8 },
          { label: "Jun 15", value: 84.6 },
          { label: "Jul 1", value: 83.9 },
        ]}
      />
    </div>
  ),
};

export const TopSetTrend: StoryObj = {
  render: () => (
    <div className="max-w-md">
      <TrendLineChart
        title="Goblet squat — top set"
        unit="kg"
        points={[
          { label: "Jun 1", value: 16 },
          { label: "Jun 8", value: 20 },
          { label: "Jun 15", value: 22 },
          { label: "Jun 22", value: 22 },
          { label: "Jun 29", value: 24 },
        ]}
      />
    </div>
  ),
};
