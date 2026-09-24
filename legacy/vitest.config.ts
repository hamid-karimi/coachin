import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "lib/**/*.test.ts",
      "app/**/*.test.ts",
      "components/**/*.test.ts",
    ],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      // Coverage tracks the extracted-logic layer (the unit-test target per
      // the coding-style skill), not React components or Next plumbing.
      include: ["lib/**/*.ts", "app/**/lib/**/*.ts", "components/hooks/**/*.ts"],
      exclude: ["**/*.test.ts", "lib/supabase/**", "lib/ai/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
