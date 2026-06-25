import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const meta: Meta<typeof Tabs> = {
  title: "UI/Tabs",
  component: Tabs,
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const Community: Story = {
  render: () => (
    <Tabs defaultValue="leaderboards" className="w-96">
      <TabsList className="w-full">
        <TabsTrigger value="leaderboards">Leaderboards</TabsTrigger>
        <TabsTrigger value="coaching">Coaching</TabsTrigger>
        <TabsTrigger value="clubs">Clubs</TabsTrigger>
        <TabsTrigger value="friends">Friends</TabsTrigger>
      </TabsList>
      <TabsContent value="leaderboards" className="text-muted-foreground py-4 text-sm">
        Global, club and circle rankings.
      </TabsContent>
      <TabsContent value="coaching" className="text-muted-foreground py-4 text-sm">
        Your coaches and students.
      </TabsContent>
      <TabsContent value="clubs" className="text-muted-foreground py-4 text-sm">
        Create, join, and manage clubs.
      </TabsContent>
      <TabsContent value="friends" className="text-muted-foreground py-4 text-sm">
        Following and discovery.
      </TabsContent>
    </Tabs>
  ),
};
