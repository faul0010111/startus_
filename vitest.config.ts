import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    include: ["**/*.spec.ts", "**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
    coverage: { provider: "v8", reporter: ["text", "lcov"] },
  },
  resolve: {
    alias: {
      "@stratus/shared-types": resolve(__dirname, "packages/shared-types/src/index.ts"),
      "@stratus/event-contracts": resolve(__dirname, "packages/event-contracts/src/index.ts"),
      "@stratus/security-rules": resolve(__dirname, "packages/security-rules/src/index.ts"),
      "@stratus/config": resolve(__dirname, "packages/config/src/index.ts"),
      "@stratus/observability": resolve(__dirname, "packages/observability/src/index.ts"),
    },
  },
});
