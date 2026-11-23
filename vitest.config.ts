import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    exclude: ["node_modules", ".next", "e2e/**"],
    // The integration suites share one local database, so run files one at a time.
    fileParallelism: false,
  },
});
