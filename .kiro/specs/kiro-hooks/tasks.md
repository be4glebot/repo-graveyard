# Implementation Plan: Kiro hooks

## Overview

Moved from the-seance tasks (former group 17). All tasks are done.

## Tasks

- [x] 1. Create the secret scanner
  - [x] 1.1 Create `scripts/secret-scan.mjs` and the `scan:secrets` npm script
    - Scan tracked and staged files for the Secret_Patterns, skip `.env.example` and binary files, fail if `.env.local` is tracked, print only `file:line: <pattern name>`, exit 1 on a hit, otherwise print "secret-scan: clean"
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 1.2 Write tests for the secret scanner
    - Create `tests/unit/secret-scan.test.ts`: fake key detected, placeholders ignored, output never contains the key, one CLI run in a temporary git repo
    - _Requirements: 3.1_

- [x] 2. Add the hooks and docs
  - [x] 2.1 Add `.kiro/hooks/secret-guard.json` and `.kiro/hooks/test-changed-files.json`
    - PostFileSave, command actions, schema v1
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 2.2 Add a "Kiro hooks" section to `docs/KIRO_JOURNEY.md`
    - What each hook does and why
    - _Requirements: 3.2_

## Notes

- Everything here is already implemented; the spec exists to record the work moved out of the-seance.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "2.2"] }
  ]
}
```
