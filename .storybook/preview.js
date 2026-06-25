import React from "react";
import "../app/globals.css";

const withTheme = (Story, context) => {
  const theme = context.globals.theme || "light";
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
      defaultValue: "light",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: [
          { value: "light", icon: "sun", title: "Light" },
          { value: "dark", icon: "moon", title: "Dark" },
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
