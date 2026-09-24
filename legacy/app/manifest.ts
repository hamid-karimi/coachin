import type { MetadataRoute } from "next";

// PWA manifest, served at /manifest.webmanifest by Next's metadata API.
// Colors mirror the "Volt Ember" dark base in globals.css so the install
// splash and OS chrome match the app's default (dark) theme.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CoachIn — Consistency, gamified",
    short_name: "CoachIn",
    description:
      "Consistency, gamified — plan your week, log workouts, level up.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0e0e11",
    theme_color: "#0e0e11",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
