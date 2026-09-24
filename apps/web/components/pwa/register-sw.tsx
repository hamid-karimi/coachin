"use client";

import { useEffect } from "react";

// Registers the service worker once, on the client, after the page loads.
// Renders nothing — it exists only for the side effect. Skips registration
// in dev so an aggressive SW never masks local changes.
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failures are non-fatal: the app still works online.
      });
    };

    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
