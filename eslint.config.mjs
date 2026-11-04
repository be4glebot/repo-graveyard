import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Patterns to reject when a server-only module imports the client-only
// override store. Covers relative, alias, and bare specifiers ending in
// `lib/overrides` or `overrides`.
const OVERRIDES_IMPORT_PATTERNS = [
  "**/overrides",
  "*/overrides",
  "./overrides",
  "../overrides",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // `lib/overrides.ts` is client-only (Req 6.7). Server-only modules and the
  // server-rendered graveyard route/page must never import it. Enforcing this
  // via `no-restricted-imports` scoped to the known server files makes the
  // boundary a lint error the moment one of those modules reaches for it.
  {
    files: [
      "lib/github.ts",
      "lib/cache.ts",
      "lib/graveyard-loader.ts",
      "app/**/page.tsx",
      "app/**/route.ts",
      "app/**/layout.tsx",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: OVERRIDES_IMPORT_PATTERNS,
              message:
                "lib/overrides is client-only (localStorage) and must not be imported by server modules. See Requirement 6.7.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
