import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";
import { Button } from "./button";

const meta: Meta<typeof Card> = {
  title: "UI/Card",
  component: Card,
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Today&apos;s plan</CardTitle>
        <CardDescription>Monday · 24 June</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        You have 2 sessions left today. Log them to keep your 12-day streak.
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="brand">Log workout</Button>
        <Button variant="outline">Skip</Button>
      </CardFooter>
    </Card>
  ),
};
