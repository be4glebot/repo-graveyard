# Building Repo Graveyard with Kiro: a build journal

Write in this file **as you go**, a few lines after each session. It becomes the Kiro write-up on Devpost and the blog post. Screenshots go in `docs/journey/` and are linked from here.

---

## 1. Strategy (one paragraph, finalize at the end)

> Spec-driven development for anything that must be *correct*: lifecycle classification, séance grounding and the Kiro export, each backed by property tests derived from EARS requirements. Vibe coding for anything that must *feel right*: creatures, animation and atmosphere, iterated quickly against the design canvas. Steering is the project's memory and design system (always / fileMatch / manual). Hooks are automatic guardrails, custom agents are reviewers, and MCP brings in live data, including **graveyard-mcp, a tool we built for Kiro**. The app's headline feature, **Revive in Kiro**, outputs Kiro specs, so the product and the process share one idea: specs are how abandoned work comes back.

## 2. Credit log

| Date | Work | Mode / model | Credits | Notes |
|---|---|---|---|---|
| | Spec 1 lifecycle | Spec, Auto | | |

Total by submission: ____ of 4,000.

## 3. Specs

For each spec: what Analyze Requirements caught, what you edited by hand in each phase, and how many tasks ran cleanly.

| Spec | Requirements gaps found | Hand edits | Tasks | Property tests | Bugs PBT caught |
|---|---|---|---|---|---|
| 1 Lifecycle | e.g. nested decay lists unreadable to analyzer → rewritten inline | few-issues signal, revive rules, not-found semantics | | 88 tests | |
| 2 Scene | | | | | |
| 3 Detail panel | | | | | |
| 4 Séance | | | | | |
| 6 Revive in Kiro | | | | | |
| 7 Badges | | | | | |
| 8 graveyard-mcp | | | | | |
| 9 Sound | | | | | |

### Bugs property tests caught (the best write-up material)
Record the failing input fast-check shrank to, what was wrong, and the fix.
- 

## 4. Steering

Why three inclusion modes: always-on files are the product's memory; `design.md` only loads for UI files so backend tasks stay cheap; manual `/design-review` and `/a11y-review` run on demand. Note each time steering visibly changed Kiro's output (screenshot with vs without).
- 

## 5. Hooks

| Hook | Trigger | Action | Times fired | What it caught | Credits |
|---|---|---|---|---|---|
| Run tests | Post Task Execution | command `npm test -- --run` | | | 0 |
| API guard | File Create `app/api/**/route.ts` | agent prompt | | | |
| New creature | File Create `components/creatures/*.tsx` | agent prompt | | | |
| Secret guard | PostFileSave (all files except node_modules, .next, local env) | command: node scripts/secret-scan.mjs | | | 0 |
| Test what I touched | PostFileSave (lib/components/app source) | command: npx vitest run --changed | | | 0 |

### Kiro hooks (committed in .kiro/hooks/)

I added two more hooks. Both are standalone JSON files in `.kiro/hooks/` (schema v1, trigger `PostFileSave`) and both use the **run command** action instead of an agent prompt, so they cost no credits and start no agent loop.

**Secret guard** (`.kiro/hooks/secret-guard.json`) runs `node scripts/secret-scan.mjs` after a file is saved (any file except node_modules, .next and the local env file). The script is dependency-free Node, also available as `npm run scan:secrets`. It scans git-tracked and staged files for the Anthropic key prefix `sk-ant-`, GitHub tokens (`ghp_`, `github_pat_`) and a non-placeholder Upstash REST token. It skips `.env.example` and binary files, and fails if the local env file is ever tracked by git. On a hit it prints only `file:line: <pattern name>`, never the value or the line, and exits 1. Why: the app is public for the judges and holds an Anthropic key, a GitHub token and a Redis token, so a leaked key in a commit or a log is the one mistake that can't be undone. The guard keeps the secret handling honest and visible. It's covered by `tests/unit/secret-scan.test.ts` (matcher, placeholders, output never contains the key, one CLI run in a temp git repo).

**Test what I touched** (`.kiro/hooks/test-changed-files.json`) runs `npx vitest run --changed --reporter=dot` when a file under `lib/**/*.ts`, `components/**/*.tsx` or `app/**/*.ts` is saved. Why: I get quick feedback on only the tests related to the uncommitted change (seconds) instead of the full suite (about 40 seconds), so regressions show up while the change is still fresh. The full run stays for checkpoints and the older "Run tests after each task" hook.

`tests/unit/kiro-hooks.test.ts` checks that both hook files parse and that their path matchers (regexes, not globs) include and exclude the right paths.

One honest note: in Kiro's v1 schema `PostFileSave` fires when the agent saves or edits a file, so edits I type by hand in the editor don't trigger it. For those, I run `npm run scan:secrets` (or `npx vitest run --changed`) by hand or before each commit.

## 6. MCP

- **graveyard-mcp (ours):** first time Kiro called `turning_soon` on my own account, what it said, screenshot.
- **Playwright MCP:** design-critic loop, before/after screenshots per screen.
- **Docs MCP:** an API it stopped Kiro from hallucinating.
- **GitHub MCP:** what it was used for.

## 7. Custom agents and powers

- design-critic: best catch
- voice-editor: a line it rewrote
- graveyard-keeper: its recommendation for my own repos
- Figma power: what was imported and how it compared

## 8. Experiments

| # | Experiment | Setup | Result | Takeaway |
|---|---|---|---|---|
| 1 | Spec vs vibe on the same feature | | | |
| 2 | Command hook vs agent hook | | | |
| 3 | Autopilot vs Supervised | | | |
| 4 | Auto vs stronger model for a design phase | | | |
| 5 | Kiro CLI vs IDE | | | |
| 6 | With vs without design.md steering | | | |

## 9. Dogfooding: I revived my own zombie

Repo: ______. Days quiet: ____. Exported with Revive in Kiro on ____, opened in Kiro, completed tasks ____, pushed on ____. Badge before/after screenshots.

## 10. What didn't work

Honest misses and how you changed course (judges reward experimentation, including failures).
- 

## 11. Disclosures

- Planning and first drafts of steering docs were made with Claude outside Kiro.
- Creature and backdrop art was generated with ChatGPT image generation from `docs/ART_PROMPTS.md`, then cleaned up by hand.
- All application code, specs, hooks, steering and agents were built in Kiro.

---

## 12. graveyard-mcp: a tool we built for Kiro

### The spec

graveyard-mcp is a small, read-only Model Context Protocol server that lets Kiro (or any MCP client) consult a Repo Graveyard. The spec has three parts. First, one new app route, `GET /api/graveyard/[owner]`, a thin wrapper over `loadGraveyard` and `classify` with its own per-IP bucket (60 requests an hour), so the existing cache and GitHub budget still apply. Second, a stdio server in `mcp/graveyard-mcp/` with four tools: `list_graveyard`, `get_grave`, `hold_seance` and `get_revival_brief`. Third, the wiring: a committed `.kiro/settings/mcp.json`, npm scripts for install and build, and a README section. The requirements are written in EARS and cover tool listing, input validation, a 12 KiB result cap, timeouts and friendly errors. The design makes every network or parse failure a value that is mapped to one fixed message, so handlers only compose values. The server is a factory that takes `fetch`, a clock and timers, so tests connect an MCP client through the SDK's in-memory transport and never touch the network or an LLM. One deliberate deviation came from probing the SDK: `registerTool` turns an unknown tool name and bad arguments into ordinary `isError` results, but the requirements want a protocol error for an unknown tool and a message that states the allowed pattern. So the server registers `tools/list` and `tools/call` handlers over a static tool table instead.

### Isolation and no secrets

The server holds no secrets by construction. It reads exactly one environment variable, `GRAVEYARD_URL` (default `http://localhost:3000`), and no GitHub token or LLM key. It sends only a GET to `/api/graveyard/[owner]` and a POST to `/api/seance`, with no cookies or authorization headers, so every limit, cache and daily budget stays inside the app. A séance call from the MCP is therefore just another séance call to the app, and the app alone decides whether it is served, limited or refused. Every tool is annotated `readOnlyHint: true`, and none writes to GitHub, the app or the file system. The package is also isolated from the Next.js app. It has its own `package.json` with exact pins (`@modelcontextprotocol/sdk` 1.32.2, `zod` 4.6.7, `esbuild` 0.28.2), and I confirmed that the SDK supports zod 4 in a scratch project before writing the design. It is deliberately not an npm workspace, so the root `package.json` gains three scripts and no dependency. It may import only four pure helpers from `lib/revive-brief.ts` and the schemas from `lib/seance-schema.ts`, and a static test scans import specifiers to enforce that. An esbuild script resolves the `@/` alias and inlines those modules into one `dist/index.js`, which must start under `node` with the root `node_modules` absent. The root `tsconfig.json` excludes `mcp/**` and ESLint ignores the generated bundle, so a fresh clone and the Vercel build don't depend on `mcp:install`.

### Untrusted text

Séance text is derived from READMEs and commit messages, so a hostile repo could try to instruct whatever assistant reads the tool result. The spec treats that text as data. The `DATA_NOTICE` from `lib/revive-brief.ts` goes before the first piece of séance-derived text, and every string from the app, including repo names, goes through `sanitiseInline` first, so a value can't open a heading, a code fence or a list item. Each result line is built as a fixed label followed by the sanitised value, so a value is never at the start of a line. The server's own headings come from a small fixed set of literals and are never built from payload text. As a second layer, a guard checks each sanitised value for heading, setext, fence, block-quote or notice-lookalike lines. If one is found, the call fails closed with "The app returned unexpected text." and shows none of it. Tests inject an identity sanitiser to prove that the guard works. Tool descriptions also say that results are data, not instructions. For the revival brief, the `REVIVAL.md` and Kiro prompt text from `buildReviveBrief` and `buildKiroPrompt` are embedded byte for byte inside fences longer than any backtick run in the text. Property tests feed hostile strings through every tool and check that the notice appears exactly once, that no séance text comes before it, and that every heading after it is one the server generated itself.
