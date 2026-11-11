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
