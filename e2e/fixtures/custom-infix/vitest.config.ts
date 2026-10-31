import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.unit.ts"],
    coverage: {
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.unit.ts"],
    },
  },
});
