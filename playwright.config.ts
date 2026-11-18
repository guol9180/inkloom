import { defineConfig } from "@playwright/test";

const inheritedEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(
    (entry): entry is [string, string] => entry[1] !== undefined
  )
);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    channel: "chrome",
    viewport: { width: 1440, height: 960 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: [
    {
      command: "node services/api/dist/server.mjs",
      url: "http://127.0.0.1:3001/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: {
        ...inheritedEnvironment,
        PORT: "3001",
        INKLOOM_DATABASE_PATH: ".inkloom/e2e.sqlite",
        INKLOOM_WEB_ORIGINS: "http://127.0.0.1:4173"
      }
    },
    {
      command: "node apps/web/serve.mjs",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: {
        ...inheritedEnvironment,
        PORT: "4173"
      }
    }
  ]
});
