import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Vitest globalSetup for the `mcp` project only. Fails fast with one clear line
// when the MCP package's own dependencies have not been installed.
export default function setup(): void {
  const sdk = fileURLToPath(
    new URL("../node_modules/@modelcontextprotocol/sdk", import.meta.url),
  );
  if (!existsSync(sdk)) {
    throw new Error(
      "graveyard-mcp dependencies are missing. Run: npm run mcp:install",
    );
  }
}
