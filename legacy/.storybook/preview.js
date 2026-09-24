import React from "react";
import "../app/globals.css";

// The app gets its fonts from next/font in the root layout; Storybook loads
// the same families from Google Fonts and wires up the CSS variables.
if (typeof document !== "undefined") {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap";
  document.head.appendChild(link);
  document.documentElement.style.setProperty(
    "--font-instrument-sans",
    "'Instrument Sans'",
  );
  document.documentElement.style.setProperty(
    "--font-space-grotesk",
    "'Space Grotesk'",
  );
}

const withTheme = (Story, context) => {
  const theme = context.globals.theme || "dark";
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.body.style.background = "var(--background)";
    document.body.style.color = "var(--foreground)";
  }
  return React.createElement(
    "div",
    { style: { padding: "1.5rem", fontFamily: "var(--font-sans)" } },
    React.createElement(Story),
  );
};

const preview = {
  globalTypes: {
    theme: {
      description: "Light / dark theme",
      // Volt Ember is dark-first; light is the warm off-white twin.
      defaultValue: "dark",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: [
          { value: "dark", icon: "moon", title: "Dark" },
          { value: "light", icon: "sun", title: "Light" },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [withTheme],
  parameters: {
    layout: "centered",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
