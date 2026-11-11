# Design Document: Kiro hooks

## Overview

Two small pieces: a dependency-free Node ESM script and two Kiro hook files. The work is already implemented.

## Architecture

- `scripts/secret-scan.mjs`: lists files with `git ls-files -z` plus `git diff --cached --name-only -z`, skips `.env.example` and binary files, tests each line against the Secret_Pattern list, and reports `file:line: <pattern name>` only. It also fails when `.env.local` is tracked. Pure helpers are exported; main runs only when the file is executed directly. Works on Windows.
- `package.json` script: `"scan:secrets": "node scripts/secret-scan.mjs"`.
- `.kiro/hooks/secret-guard.json`: PostFileSave, command `node scripts/secret-scan.mjs`.
- `.kiro/hooks/test-changed-files.json`: PostFileSave, command `npx vitest run --changed --reporter=dot`.
- `docs/KIRO_JOURNEY.md`: a "Kiro hooks" section.

## Testing Strategy

`tests/unit/secret-scan.test.ts` covers a runtime-built fake key (detected), `.env.example` placeholders (ignored), output that never contains the key text, and one CLI run in a temporary git repository.

## Components and Interfaces

- `scripts/secret-scan.mjs` exports pure helpers (pattern matching, file filtering, report formatting) for tests.
- Two hook JSON files in `.kiro/hooks/` invoke the script and Vitest.

## Data Models

- A finding is `{ file: string, line: number, pattern: string }`. It never stores the matched text.

## Correctness Properties

*A property is a characteristic that should hold across all valid executions.*

### Property 1: Findings never leak the secret

*For any* file content containing a Secret_Pattern, the printed report contains the file, line number and pattern name, and does not contain the secret value.

**Validates: Requirements 1.4, 3.1**

## Error Handling

- A tracked `.env.local` fails the scan with exit code 1.
- A binary or unreadable file is skipped without failing the run.
