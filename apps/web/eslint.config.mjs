// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";
import pluginQuery from "@tanstack/eslint-plugin-query";

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...pluginQuery.configs["flat/recommended"],
  {
    // eslint-plugin-react 7.x can't auto-detect the React version under
    // ESLint 10 (it calls the removed context.getFilename); state it instead.
    settings: { react: { version: "19.3" } },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "storybook-static/**",
    "next-env.d.ts",
    "lib/api/schema.d.ts",
  ]),
  ...storybook.configs["flat/recommended"],
]);

export default eslintConfig;
