"use client";

import { useEffect, useRef } from "react";

// Volt + ember + gold — the celebration palette, read from the theme tokens.
const CONFETTI_TOKENS = ["--brand", "--flame", "--tier-gold", "--xp"];

function confettiColors(): string[] {
  const style = getComputedStyle(document.documentElement);
  return CONFETTI_TOKENS.map((token) => style.getPropertyValue(token).trim()).filter(Boolean);
}

/** Fires the two-sided celebration confetti burst once, the first time
 *  `active` turns true. Dynamic import keeps canvas-confetti out of SSR. */
export function useConfettiBurst(active: boolean) {
  const fired = useRef(false);

  useEffect(() => {
    if (!active || fired.current) return;
    fired.current = true;

    import("canvas-confetti").then((mod) => {
      const confetti = mod.default;
      const duration = 2 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = {
        startVelocity: 30,
        spread: 360,
        ticks: 60,
        zIndex: 50,
        colors: confettiColors(),
      };

      const randomInRange = (min: number, max: number) =>
        Math.random() * (max - min) + min;

      const interval: ReturnType<typeof setInterval> = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        });
      }, 250);
    });
  }, [active]);
}
