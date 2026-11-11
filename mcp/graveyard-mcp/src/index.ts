import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { parseBaseUrl } from "./config";
import { createServer } from "./server";

const STARTUP_FAILURE_LINE = "graveyard-mcp failed to start.";

async function main(): Promise<void> {
  const config = parseBaseUrl(process.env.GRAVEYARD_URL);
  if (!config.ok) {
    process.stderr.write(config.line + "\n");
    process.exit(1);
  }

  const server = createServer({
    baseUrl: config.baseUrl,
    fetch: globalThis.fetch,
    now: Date.now,
  });
  await server.connect(new StdioServerTransport());
}

main().catch(() => {
  try {
    process.stderr.write(STARTUP_FAILURE_LINE + "\n");
  } finally {
    process.exit(1);
  }
});
