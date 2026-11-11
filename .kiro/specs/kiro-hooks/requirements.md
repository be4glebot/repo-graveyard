# Requirements Document

## Introduction

Kiro hooks is repo tooling moved out of the-seance spec (former task group 17). Two PostFileSave hooks protect secrets and give fast test feedback. All requirements are implemented.

## Glossary

- **Secret_Scanner**: The script `scripts/secret-scan.mjs`, run through `npm run scan:secrets`.
- **Secret_Pattern**: One of `sk-ant-`, `ghp_`, `github_pat_`, or `UPSTASH_REDIS_REST_TOKEN=` followed by a non-placeholder value.
- **Hook**: A JSON file in `.kiro/hooks/` using schema v1.

## Requirements

### Requirement 1: Secret scanning

**User Story:** As a developer, I want a scan for leaked keys, so that the Anthropic and GitHub credentials never reach git.

#### Acceptance Criteria

1. WHEN the Secret_Scanner runs, THE Secret_Scanner SHALL scan git-tracked files and staged files for every Secret_Pattern.
2. THE Secret_Scanner SHALL skip `.env.example` and binary files.
3. IF `git ls-files .env.local` returns a path, THEN THE Secret_Scanner SHALL fail.
4. IF a Secret_Pattern is found, THEN THE Secret_Scanner SHALL print only `file:line: <pattern name>`, exit with code 1, and print no part of the matching line.
5. WHEN no Secret_Pattern is found, THE Secret_Scanner SHALL print "secret-scan: clean" and exit with code 0.
6. THE Secret_Scanner SHALL export its pure functions for tests and run its main routine only when executed directly.

### Requirement 2: Hooks

**User Story:** As a developer, I want automatic checks on save, so that I get quick feedback.

#### Acceptance Criteria

1. WHEN a file is saved, THE secret-guard Hook SHALL run `node scripts/secret-scan.mjs`.
2. WHEN a file is saved, THE test-changed-files Hook SHALL run `npx vitest run --changed --reporter=dot`.
3. THE Hooks SHALL use the PostFileSave trigger and command actions.

### Requirement 3: Documentation and tests

**User Story:** As a developer, I want the hooks explained and tested, so that they stay trustworthy.

#### Acceptance Criteria

1. THE test suite SHALL detect a fake key built at runtime, ignore `.env.example` placeholders, and show that output never contains the key text.
2. THE docs/KIRO_JOURNEY.md file SHALL describe what each Hook does and why.
