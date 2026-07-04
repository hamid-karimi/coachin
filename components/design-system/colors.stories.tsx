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
  background,
  onLoud = false,
}: {
  name: string;
  varName?: string;
  /** Explicit background (e.g. the ember gradient); defaults to var(varName). */
  background?: string;
  /** Loud fills (volt, ember) take dark text; quiet ones inherit foreground. */
  onLoud?: boolean;
}) {
  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <div
        className="flex h-16 items-end p-2 text-[11px] font-medium"
        style={{
          background: background ?? `var(${varName})`,
          color: onLoud ? "#17161A" : "var(--foreground)",
        }}
      >
        {varName ?? name}
      </div>
      <div className="bg-card text-card-foreground px-2 py-1.5 text-xs">
        {name}
      </div>
    </div>
  );
}

export const Brand: Story = {
  name: "Volt & Ember",
  render: () => (
    <div className="grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
      <Swatch name="Volt — act & progress" varName="--brand" onLoud />
      <Swatch
        name="Ember — streaks & celebration"
        background="linear-gradient(135deg, var(--ember-from), var(--ember-to))"
        onLoud
      />
      <Swatch name="Flame" varName="--flame" onLoud />
      <Swatch name="Success" varName="--success" onLoud />
      <Swatch name="Volt tint" varName="--brand-tint" />
      <Swatch name="XP tint" varName="--xp-tint" />
      <Swatch name="Flame tint" varName="--flame-tint" />
      <Swatch name="Destructive" varName="--destructive" onLoud />
    </div>
  ),
};

export const Surfaces: Story = {
  render: () => (
    <div className="grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
      <Swatch name="Background" varName="--background" />
      <Swatch name="Card / surface" varName="--card" />
      <Swatch name="Raised / secondary" varName="--secondary" />
      <Swatch name="Border" varName="--border" />
      <Swatch name="Foreground" varName="--foreground" onLoud />
      <Swatch name="Muted foreground" varName="--muted-foreground" onLoud />
      <Swatch name="Popover" varName="--popover" />
      <Swatch name="Ring (focus)" varName="--ring" onLoud />
    </div>
  ),
};

export const Tiers: Story = {
  name: "League tiers",
  render: () => (
    <div className="grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
      <Swatch name="Bronze" varName="--tier-bronze" onLoud />
      <Swatch name="Silver" varName="--tier-silver" onLoud />
      <Swatch name="Gold" varName="--tier-gold" onLoud />
      <Swatch name="Platinum" varName="--tier-platinum" onLoud />
      <Swatch name="Bronze tint" varName="--tier-bronze-tint" />
      <Swatch name="Silver tint" varName="--tier-silver-tint" />
      <Swatch name="Gold tint" varName="--tier-gold-tint" />
      <Swatch name="Platinum tint" varName="--tier-platinum-tint" />
    </div>
  ),
};
