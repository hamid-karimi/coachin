import type { Meta, StoryObj } from "@storybook/nextjs-vite";

const meta: Meta = {
  title: "Design System/Typography",
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj;

export const Scale: Story = {
  render: () => (
    <div className="text-foreground flex max-w-2xl flex-col gap-5">
      <div>
        <p className="font-display text-[40px] font-bold tracking-tight">
          Display 40 · Grotesk 700
        </p>
        <p className="text-muted-foreground text-xs">
          Hero moments — auth panel, celebrations
        </p>
      </div>
      <div>
        <p className="font-display text-[28px] font-bold tracking-tight">
          Title 28 · Grotesk 700
        </p>
        <p className="text-muted-foreground text-xs">Page titles</p>
      </div>
      <div>
        <p className="text-xl font-semibold">Heading 20 · Instrument 600</p>
        <p className="text-muted-foreground text-xs">Section headers</p>
      </div>
      <div>
        <p className="text-base font-medium">
          Body 16 · Instrument 500 — log a workout to earn XP.
        </p>
        <p className="text-muted-foreground text-xs">Default copy</p>
      </div>
      <div>
        <p className="text-muted-foreground text-sm">
          Secondary 14 · Instrument 400 — 3 of 5 sessions done
        </p>
        <p className="text-muted-foreground text-xs">Metadata, hints</p>
      </div>
      <div>
        <p className="text-overline">Overline 11 · Caps 0.08em</p>
        <p className="text-muted-foreground text-xs">
          Stat labels, section eyebrows
        </p>
      </div>
      <div>
        <p className="text-brand-ink text-[32px] text-stat">
          1,240{" "}
          <span className="text-muted-foreground font-sans text-sm font-medium">
            Stat numerals · Grotesk, tabular (`text-stat`)
          </span>
        </p>
        <p className="text-muted-foreground text-xs">
          Everywhere stats live — XP, ranks, streaks
        </p>
      </div>
    </div>
  ),
};

export const Weights: Story = {
  render: () => (
    <div className="text-foreground flex flex-col gap-2">
      <p className="text-base font-normal">Instrument Sans · Regular 400</p>
      <p className="text-base font-medium">Instrument Sans · Medium 500</p>
      <p className="text-base font-semibold">Instrument Sans · Semibold 600</p>
      <p className="text-base font-bold">Instrument Sans · Bold 700</p>
      <p className="font-display text-base font-medium">
        Space Grotesk · Medium 500
      </p>
      <p className="font-display text-base font-bold">
        Space Grotesk · Bold 700
      </p>
    </div>
  ),
};
