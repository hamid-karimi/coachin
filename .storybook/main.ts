import type { StorybookConfig } from '@storybook/nextjs-vite';

const config: StorybookConfig = {
  "stories": [
    "../app/**/*.stories.@(js|jsx|mjs|ts|tsx|mdx)"
  ],
  "addons": [],
  "framework": "@storybook/nextjs-vite",
  "staticDirs": [
    "../public"
  ]
};
export default config;