// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "storybook-static/**",
    "next-env.d.ts",
    // Build artifacts can also live inside nested working copies (e.g. agent
    // worktrees under .claude/), so ignore those + any nested build output.
    ".claude/**",
    "**/.next/**",
    "**/storybook-static/**",
  ]),
  ...storybook.configs["flat/recommended"],
]);

export default eslintConfig;
