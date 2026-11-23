import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "threads",
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 15_000,
    hookTimeout: 15_000,
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/target/**",
      "tests/e2e/**"
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      thresholds: {
        statements: 30,
        branches: 25,
        functions: 25,
        lines: 30
      },
      include: [
        "apps/web/src/**/*.{ts,tsx}",
        "packages/*/src/**/*.{ts,tsx}",
        "services/api/src/**/*.ts"
      ],
      exclude: [
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.d.ts",
        "apps/web/src/main.tsx",
        "apps/web/src/vite-env.d.ts"
      ]
    }
  }
});
