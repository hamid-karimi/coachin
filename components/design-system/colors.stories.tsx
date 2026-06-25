import type { Meta, StoryObj } from "@storybook/nextjs-vite";

const meta: Meta = {
  title: "Design System/Colors",
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj;

function Swatch({
  name,
  varName,
  text = "#fff",
}: {
  name: string;
  varName: string;
  text?: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div
        className="flex h-16 items-end p-2 text-[11px]"
        style={{ background: `var(${varName})`, color: text }}
      >
        {varName}
      </div>
      <div className="bg-card px-2 py-1.5 text-xs text-card-foreground">
        {name}
      </div>
    </div>
  );
}

export const Brand: Story = {
  render: () => (
    <div className="grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
      <Swatch name="Primary / active" varName="--brand" />
      <Swatch name="XP / energy" varName="--xp" text="#412402" />
      <Swatch name="Streak / flame" varName="--flame" />
      <Swatch name="Platinum tier" varName="--tier-platinum" />
      <Swatch name="Brand tint" varName="--brand-tint" text="#0f6e56" />
      <Swatch name="XP tint" varName="--xp-tint" text="#854f0b" />
      <Swatch name="Flame tint" varName="--flame-tint" text="#993c1d" />
      <Swatch name="Secondary surface" varName="--secondary" text="#2c2c2a" />
    </div>
  ),
};

export const Semantic: Story = {
  render: () => (
    <div className="grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
      <Swatch name="Background" varName="--background" text="#171717" />
      <Swatch name="Card" varName="--card" text="#171717" />
      <Swatch name="Muted" varName="--muted" text="#5f5e5a" />
      <Swatch name="Primary" varName="--primary" />
      <Swatch name="Accent" varName="--accent" text="#0f6e56" />
      <Swatch name="Destructive" varName="--destructive" />
      <Swatch name="Ring" varName="--ring" />
      <Swatch name="Tier gold" varName="--tier-gold" text="#412402" />
    </div>
  ),
};
