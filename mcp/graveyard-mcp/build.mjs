import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const pkg = path.dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [path.join(pkg, "src/index.ts")],
  outfile: path.join(pkg, "dist/index.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  tsconfig: path.join(pkg, "tsconfig.json"), // resolves "@/*" -> repo root
  alias: { zod: path.join(pkg, "node_modules/zod") }, // one zod copy in the bundle
  banner: {
    js: "import{createRequire}from'node:module';const require=createRequire(import.meta.url);",
  },
  legalComments: "none",
  logLevel: "info",
});
