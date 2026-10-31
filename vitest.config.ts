import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      include: ["src/**/*.ts"],
      exclude: ["src/test/**", "src/**/*.mock.ts", "src/**/*.fixture.ts"],
    },
  },
});
