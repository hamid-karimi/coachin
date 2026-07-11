"use client";

import { useEffect, useState } from "react";
import {
  Camera,
  ChartLine,
  Dumbbell,
  GraduationCap,
  WandSparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";

const SLIDE_INTERVAL_MS = 5000;

const SLIDES: {
  icon: typeof Dumbbell;
  title: string;
  text: string;
}[] = [
  {
    icon: WandSparkles,
    title: "AI training plans",
    text: "Answer a few questions and get a week-by-week program — running or muscle building — that adapts as you go.",
  },
  {
    icon: Dumbbell,
    title: "Log it, earn it",
    text: "One-tap logging, XP for every session, and a streak with hearts that forgive a busy day.",
  },
  {
    icon: Camera,
    title: "Snap your meals",
    text: "A photo becomes calories and macros. Meal plans prefer food that's local and affordable where you live.",
  },
  {
    icon: GraduationCap,
    title: "A real coach in the loop",
    text: "Join your coach with a code — they see your week, build your plan, and cheer you on.",
  },
  {
    icon: ChartLine,
    title: "Proof you're improving",
    text: "Progress charts, personal records, and photo journals — evidence, not guesswork.",
  },
];

/**
 * Auto-advancing value-prop slideshow for the auth brand panel. Text + icons
 * only (no screenshots to keep current, always on-brand). Pauses on hover;
 * dots jump directly. ~5s per slide.
 */
export function FeatureSlideshow() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(
      () => setIndex((current) => (current + 1) % SLIDES.length),
      SLIDE_INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, [paused]);

  const slide = SLIDES[index];
  const Icon = slide.icon;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="What CoachIn does"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="mt-8 max-w-sm"
    >
      {/* Key remount re-runs the entrance animation per slide. */}
      <div
        key={index}
        aria-live="polite"
        className="animate-in fade-in slide-in-from-bottom-2 duration-500"
      >
        <span className="bg-brand-tint text-brand-ink grid size-12 place-items-center rounded-xl">
          <Icon className="size-6" aria-hidden />
        </span>
        <h3 className="text-foreground mt-4 text-lg font-bold">
          {slide.title}
        </h3>
        <p className="text-muted-foreground mt-1.5 min-h-18 leading-relaxed">
          {slide.text}
        </p>
      </div>

      <div className="flex items-center gap-2" role="tablist" aria-label="Slides">
        {SLIDES.map((entry, slideIndex) => (
          <button
            key={entry.title}
            type="button"
            role="tab"
            aria-selected={slideIndex === index}
            aria-label={`Slide ${slideIndex + 1}: ${entry.title}`}
            onClick={() => setIndex(slideIndex)}
            className={cn(
              "h-1.5 rounded-full transition-all",
              slideIndex === index
                ? "bg-brand w-6"
                : "bg-border hover:bg-muted-foreground/40 w-1.5",
            )}
          />
        ))}
      </div>
    </section>
  );
}
