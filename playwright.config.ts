import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Playwright does not load env files on its own. .env.local holds the local Supabase keys; the
// seed staff login is read from .env.example when .env.local does not define it. Values that are
// already set are never overridden.
for (const file of [".env.local", ".env.example"]) {
  if (existsSync(file)) {
    process.loadEnvFile(file);
  }
}

export default defineConfig({
  testDir: "e2e",
  use: {
    baseURL: "http://localhost:3000",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 } },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
});
