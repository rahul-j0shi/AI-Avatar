import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["apps/desktop/src/**/*.test.ts", "packages/*/src/**/*.test.ts"],
  },
});
