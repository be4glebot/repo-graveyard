import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  // The `server-only` marker package throws on import under any condition other
  // than `react-server` (its default `index.js` is a hard `throw`). The test
  // runner has no `react-server` condition, so importing a server module under
  // test would crash at load. Alias `server-only` to its own no-op `empty.js`
  // (the exact file the `react-server` condition resolves to in production) so
  // server modules can be unit/property tested without stripping the guard from
  // the source. This changes only the test environment, never the build.
  resolve: {
    alias: {
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["tests/**/*.test.tsx"],
        },
      },
    ],
  },
});
