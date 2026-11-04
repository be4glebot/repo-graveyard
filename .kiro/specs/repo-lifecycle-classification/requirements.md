# Requirements Document

## Introduction

This feature implements the core repository lifecycle classification system for Repo Graveyard. Given a GitHub username or organization name, the system loads all public, non-fork repositories via GraphQL, classifies each into exactly one lifecycle state (ghost, risen, zombie, tombstone, or coffin) with an appropriate decay level, applies user-defined overrides stored in localStorage, caches results in Redis, and renders a grouped list at `/g/[username]`. A minimal landing page at `/` accepts username input. All classification logic lives in pure, testable functions, and every lifecycle property is verified with fast-check property-based tests.

## Glossary

- **Ghost**: A repository with days_quiet below 90 that no earlier precedence rule has claimed. Decays across four levels as it goes quiet.
- **Risen**: A zombie the user has chosen to revive, but has not yet pushed to since the revive date and the 14-day window has not elapsed.
- **Zombie**: A repository that reaches the final precedence rule (no applicable override, not archived, days_quiet of 90 or more, not finished). Decays across five levels.
- **Tombstone**: A finished or archived-with-finished-signals repository. No decay level; cosmetic moss grows with age.
- **Coffin**: A scrapped or archived-without-finished-signals repository. No decay level.
- **Days quiet**: `floor((now − pushedAt) / 1 day)`, clamped to a minimum of 0. If `pushedAt` is null or absent, `createdAt` is used in its place.
- **Decay level**: An integer sub-classification within a state indicating how far the repo has progressed through that state's range.
- **Override**: A user-set `finished`, `scrapped`, or `revived` intent, stored per repo as `{ type, setAt }` in localStorage keyed by lowercased username; at most one per repo.
- **Finished signals**: At least one release; non-empty homepageUrl; README larger than `readmeMinBytes`; last commit subject contains v1.0, release, final, done, or ship; `stargazerCount` at or above `popularStars`.
- **Unfinished signals**: Last commit subject contains wip, todo, temp, or fix later; README size exactly zero (a not-found README is neutral); open issues at or above `manyIssues` while `stargazerCount` is below `popularStars`. A repository is finished iff finished count minus unfinished count is at least 2.
- **Lifecycle_Engine**: The pure classification module (`lib/lifecycle.ts`) that maps a repo and "now" to a lifecycle state and decay level.
- **Finished_Detector**: The pure signal evaluation module (`lib/finished.ts`) that scores finished and unfinished signals.
- **Override_Store**: The localStorage abstraction (`lib/overrides.ts`) that reads and writes per-username overrides.
- **Graveyard_Loader**: The server-side data fetching module that issues GraphQL queries and caches results in Redis.
- **Lifecycle_Config**: A single configuration object in `lib/lifecycle.ts` holding all threshold values (no magic numbers elsewhere).

---

## Requirements

### Requirement 1: GitHub Repository Loading

**User Story:** As a developer, I want the app to load all my public non-fork repositories in a single efficient operation, so that the graveyard scene builds quickly without per-repo API calls.

#### Acceptance Criteria

1. WHEN a valid GitHub username or organization name (1–39 characters, containing only alphanumeric characters or hyphens, not starting or ending with a hyphen) is provided, THE Graveyard_Loader SHALL fetch all public, non-fork repositories via the GraphQL `repositoryOwner(login:)` endpoint, ordered by `PUSHED_AT` descending, capped at 300 repositories.
2. THE Graveyard_Loader SHALL issue at most one GraphQL query per 100 repositories (≤ 3 queries for 300 repos), using cursor-based pagination.
3. THE Graveyard_Loader SHALL retrieve the following fields in the GraphQL query for each repository: `name`, `description`, `url`, `pushedAt`, `createdAt`, `isArchived`, `isFork`, `homepageUrl`, `stargazerCount`, `primaryLanguage`, open issue count, release count, README file size in bytes (aliased for both `HEAD:README.md` and `HEAD:readme.md`, with `HEAD:README.md` taking precedence if both are present), and the default branch's last commit message; and, once per query, the `totalCount` and `pageInfo.hasNextPage` of the repositories connection.
4. IF the input does not match the valid GitHub username format (1–39 characters, alphanumeric or hyphens only, not starting or ending with a hyphen), THEN THE Graveyard_Loader SHALL surface a validation error indicating the input is invalid without making any API call.
5. IF the GraphQL response contains `repositoryOwner: null` or a GraphQL error with code `NOT_FOUND`, THEN THE Graveyard_Loader SHALL surface a not-found error indicating the username does not exist.
6. IF the HTTP response status is 403 or 429, OR the GraphQL response contains an error with code `RATE_LIMITED`, THEN THE Graveyard_Loader SHALL read the `x-ratelimit-reset` header and surface a rate-limit error with the reset time.
7. IF the GitHub API returns a 5xx response and the single retry also returns a 5xx response, THEN THE Graveyard_Loader SHALL discard any partially fetched data and surface a server error indicating the load failed.

---

### Requirement 2: Graveyard List Caching

**User Story:** As a developer, I want my repository list to be cached, so that repeated visits within a short window do not exhaust the GitHub API rate limit.

#### Acceptance Criteria

1. WHEN the Graveyard_Loader successfully fetches a repository list, THE Graveyard_Loader SHALL store the raw repository facts (not the classified results) in Redis, keyed by the lowercased GitHub username, with a 10-minute TTL.
2. WHEN a cache lookup for a lowercased username returns a stored result, THE Graveyard_Loader SHALL return that cached raw repository facts without issuing new GitHub GraphQL queries.
3. WHEN a cache lookup for a lowercased username returns no stored result, THE Graveyard_Loader SHALL fetch the repository list from GitHub and store the result per criterion 1.
4. IF Redis is unavailable due to a connection error or a response timeout exceeding 2 seconds, THEN THE Graveyard_Loader SHALL bypass the cache and issue a live GitHub GraphQL fetch without surfacing a Redis error to the user.
5. IF Redis is unavailable and the live GitHub fetch also fails, THEN THE Graveyard_Loader SHALL return an error response indicating the repository list could not be retrieved.

---

### Requirement 3: Lifecycle State Classification

**User Story:** As a developer, I want each repository classified into exactly one lifecycle state, so that the graveyard can render the correct creature for every repo.

#### Acceptance Criteria

1. THE Lifecycle_Engine SHALL classify every repository into exactly one of the following states: ghost, risen, zombie, tombstone, or coffin.
2. THE Lifecycle_Engine SHALL apply the precedence rules defined in criteria 3 through 12 in order, and the first matching rule wins; Rules 3 and 5 continue evaluation from Rule 6 (the archived rule) as if no override were set.
3. Rule 1 (highest precedence): WHEN a `finished` override is set, THE Lifecycle_Engine SHALL classify the repository as tombstone.
4. Rule 2: WHEN a `scrapped` override is set, THE Lifecycle_Engine SHALL classify the repository as coffin.
5. Rule 3: WHEN a `revived` override is set and the repository's `pushedAt` timestamp is after the revive timestamp, THE Lifecycle_Engine SHALL add `revived` to the `cleared_overrides` list in the classification result and continue evaluation from Rule 6 as if no override were set.
6. Rule 4: WHEN a `revived` override is set and fewer than 14 days have elapsed since the revive timestamp and the repository's `pushedAt` timestamp is not after the revive timestamp, THE Lifecycle_Engine SHALL classify the repository as risen.
7. Rule 5: WHEN a `revived` override is set and 14 or more days have elapsed since the revive timestamp and the repository's `pushedAt` timestamp is not after the revive timestamp, THE Lifecycle_Engine SHALL add `revived` to the `cleared_overrides` list in the classification result and continue evaluation from Rule 6 as if no override were set.
8. Rule 6: WHEN the repository is archived on GitHub and the Finished_Detector returns true, THE Lifecycle_Engine SHALL classify the repository as tombstone.
9. Rule 7: WHEN the repository is archived on GitHub and the Finished_Detector returns false, THE Lifecycle_Engine SHALL classify the repository as coffin.
10. Rule 8: WHEN the repository's days_quiet is less than the ghost threshold (default 90) defined in Lifecycle_Config, THE Lifecycle_Engine SHALL classify the repository as ghost.
11. Rule 9: WHEN the Finished_Detector returns true and no earlier rule has matched, THE Lifecycle_Engine SHALL classify the repository as tombstone.
12. Rule 10 (lowest precedence): IF no earlier rule has matched, THEN THE Lifecycle_Engine SHALL classify the repository as zombie.
13. THE Lifecycle_Engine SHALL accept `now` as an explicit parameter of type ISO 8601 UTC datetime string and SHALL NOT read the system clock internally.
14. THE Lifecycle_Engine SHALL read all timing thresholds from the Lifecycle_Config object and SHALL NOT use magic numbers elsewhere in the codebase.

---

### Requirement 4: Decay Level Calculation

**User Story:** As a developer, I want each ghost and zombie assigned a decay level, so that the scene can visually convey how neglected each project is.

#### Acceptance Criteria

1. THE Lifecycle_Engine SHALL compute `days_quiet` as `floor((now − pushedAt) / 1 day)`, clamped to a minimum of 0; IF `pushedAt` is null or absent, THEN THE Lifecycle_Engine SHALL substitute `createdAt` in its place.
2. WHEN a repository is classified as ghost, THE Lifecycle_Engine SHALL assign decay level 0 if 0 ≤ days_quiet < 14, level 1 if 14 ≤ days_quiet < 30, level 2 if 30 ≤ days_quiet < 60, and level 3 if 60 ≤ days_quiet < 90.
3. WHEN a repository is classified as zombie, THE Lifecycle_Engine SHALL assign decay level 0 if days_quiet < 182, level 1 if 182 ≤ days_quiet < 365, level 2 if 365 ≤ days_quiet < 730, level 3 if 730 ≤ days_quiet < 1095, and level 4 if days_quiet ≥ 1095.
4. IF a repository is classified as tombstone or coffin, THEN THE Lifecycle_Engine SHALL not assign a numeric decay level.
5. IF a repository is classified as risen, THEN THE Lifecycle_Engine SHALL not assign a numeric decay level.
6. THE Lifecycle_Engine SHALL keep all ghost decay levels in the range 0–3 and all zombie decay levels in the range 0–4 for any `days_quiet` value ≥ 0.

---

### Requirement 5: Finished Signal Detection

**User Story:** As a developer, I want the system to automatically detect whether a quiet repo was finished or abandoned, so that I get accurate tombstone vs. zombie classification without manual input.

#### Acceptance Criteria

1. THE Finished_Detector SHALL evaluate the following finished signals for a repository: (a) the repository has at least one release, (b) the repository has a non-empty `homepageUrl`, (c) the repository's README size is greater than the `readmeMinBytes` threshold (default 1024 bytes) from Lifecycle_Config, (d) the last commit's subject line (first line of the commit message) contains any of the strings "v1.0", "release", "final", "done", or "ship", matched case-insensitively, (e) the repository's `stargazerCount` is greater than or equal to the `popularStars` threshold (default 50) from Lifecycle_Config.
2. THE Finished_Detector SHALL evaluate the following unfinished signals for a repository: (a) the last commit's subject line (first line of the commit message) contains any of the strings "wip", "todo", "temp", or "fix later", matched case-insensitively, (b) the README size is exactly zero bytes (a not-found README, where `readmeBytes` is null, is neutral and does NOT count as an unfinished signal, since the repository may have a README in a format the two bulk-query lookups cannot see), (c) the open issue count is greater than or equal to the `manyIssues` threshold (default 10) from Lifecycle_Config AND the repository's `stargazerCount` is less than the `popularStars` threshold (default 50) from Lifecycle_Config (a popular repository's open-issue backlog does not count as an unfinished signal).
3. THE Finished_Detector SHALL return true if and only if (finished signal count − unfinished signal count) ≥ 2.
4. THE Finished_Detector SHALL read the `readmeMinBytes`, `manyIssues`, and `popularStars` thresholds from Lifecycle_Config and SHALL NOT use magic numbers.

---

### Requirement 6: Override Storage

**User Story:** As a developer, I want to set per-repo overrides that persist across page loads, so that my classification decisions are remembered on my device.

#### Acceptance Criteria

1. THE Override_Store SHALL read and write overrides from localStorage using the key `repo-graveyard-overrides:{username}`, where `{username}` is the lowercased GitHub username whose graveyard is being viewed.
2. WHEN an override is written, THE Override_Store SHALL store overrides as a map of repo name to an entry `{ type, setAt }`, where `type` is one of `finished`, `scrapped`, or `revived`, and `setAt` is an ISO 8601 string recording when the override was set.
3. WHEN a new override is written for a repo that already has an override, THE Override_Store SHALL replace the existing entry for that repo name with the new entry.
4. THE Override_Store SHALL wrap every localStorage read and write in try/catch so that storage errors do not crash the application.
5. IF localStorage is unavailable or throws during a read or write operation, THEN THE Override_Store SHALL return an object with no override entries for reads and silently discard the write for writes.
6. IF the GitHub username is not available when a read is attempted, THEN THE Override_Store SHALL return an object with no override entries.
7. THE Override_Store SHALL operate client-side only and SHALL NOT be imported by any server-only module.

---

### Requirement 7: Lifecycle Property-Based Tests

**User Story:** As a developer, I want comprehensive property-based tests covering every lifecycle invariant, so that regressions in classification logic are caught automatically.

#### Acceptance Criteria

1. THE Lifecycle_Engine test suite SHALL verify totality and exclusivity: for any combination of the input fields (`pushedAt`, `isArchived`, `override`, `reviveTimestamp`) and any ISO 8601 UTC `now` value, the classification result is exactly one of ghost, risen, zombie, tombstone, or coffin.
2. THE Lifecycle_Engine test suite SHALL verify that a `finished` or `scrapped` override always produces tombstone or coffin respectively, regardless of any other repository field values.
3. THE Lifecycle_Engine test suite SHALL verify that a repository whose `pushedAt` is strictly less than 90 days before `now`, with no override set and `isArchived` false, always produces ghost.
4. THE Lifecycle_Engine test suite SHALL verify, for repositories with no override set and `isArchived` false, that with all other fields equal, increasing `days_quiet` never turns a non-ghost classification into a ghost classification, and never lowers the decay level within the ghost or zombie state.
5. THE Lifecycle_Engine test suite SHALL verify that all ghost decay levels remain in the range 0–3 and all zombie decay levels remain in the range 0–4 for any `days_quiet` value ≥ 0, including future-dated and missing `pushedAt` inputs.
6. THE Lifecycle_Engine test suite SHALL verify that a `revived` override with `pushedAt` after the revive timestamp includes `revived` in `cleared_overrides` and yields the same state and decay level as the same repository with no override.
7. THE Lifecycle_Engine test suite SHALL verify that a `revived` override produces risen, with no `cleared_overrides`, when fewer than 14 days have elapsed since the revive timestamp and `pushedAt` is not after the revive timestamp.
8. THE Lifecycle_Engine test suite SHALL verify that a `revived` override with 14 or more days elapsed since the revive timestamp and `pushedAt` not after the revive timestamp includes `revived` in `cleared_overrides` and yields the same state and decay level as the same repository with no override.
9. THE Finished_Detector test suite SHALL verify, using fast-check, that the detector returns true if and only if (finished signal count − unfinished signal count) ≥ 2, for any combination of signal inputs.
10. THE Finished_Detector test suite SHALL verify, using fast-check, that adding an unfinished signal to any input set that already returns false never causes the detector to return true.
11. THE Lifecycle_Engine test suite SHALL use fast-check for all property assertions and SHALL be runnable via `vitest --run`.

---

### Requirement 8: Graveyard Page Route

**User Story:** As a developer, I want to navigate to `/g/[username]` and see my classified repositories grouped by state, so that I can immediately understand where each project stands.

#### Acceptance Criteria

1. WHEN a username of 1–39 characters containing only alphanumeric characters and hyphens, not starting or ending with a hyphen, is requested at `/g/[username]`, THE Graveyard_Page SHALL display all classified repositories grouped by lifecycle state (ghosts, risen, zombies, tombstones, coffins).
2. WHEN a username has no public non-fork repositories, THE Graveyard_Page SHALL display an empty-state message indicating no repositories were found.
3. WHEN the Graveyard_Loader returns a not-found error, THE Graveyard_Page SHALL display a clear error message indicating the username does not exist on GitHub.
4. WHEN the Graveyard_Loader returns a rate-limit error, THE Graveyard_Page SHALL display an error message including the rate-limit reset time.
5. THE Graveyard_Page SHALL render each repository entry showing: repository name, lifecycle state, and days quiet; and additionally decay level for repositories in the ghost or zombie state.
6. THE Graveyard_Page SHALL fetch raw repository facts server-side (keeping the GitHub token server-only) and may render an initial classification without overrides during server-side rendering; WHEN the page hydrates on the client, THE Graveyard_Page SHALL re-run the same pure classifier with the user's overrides from the Override_Store and update the displayed classifications accordingly.
7. IF the Graveyard_Loader returns an error that is neither a not-found error nor a rate-limit error, THEN THE Graveyard_Page SHALL display an error message indicating that repository data could not be loaded.
8. WHEN the username in `/g/[username]` does not match the valid GitHub username format (1–39 characters, alphanumeric and hyphens only, not starting or ending with a hyphen), THE Graveyard_Page SHALL display a validation error message indicating the username format is invalid.
9. WHEN the owner has more than 300 public non-fork repositories (determined from the GraphQL `totalCount` or `hasNextPage` after the 300th repository), THE Graveyard_Page SHALL display the notice "showing the 300 most recently pushed."

---

### Requirement 9: Landing Page Route

**User Story:** As a developer, I want a minimal landing page at `/` with a username input box, so that I can enter any GitHub username and navigate to their graveyard.

#### Acceptance Criteria

1. THE Landing_Page SHALL render a text input that accepts a GitHub username or organization name of 1–39 characters containing only alphanumeric characters and hyphens, not starting or ending with a hyphen.
2. WHEN the user presses Enter within the input field or activates the submit button, THE Landing_Page SHALL navigate the user to `/g/[username]`.
3. THE Landing_Page SHALL be keyboard accessible: the input field and submit button SHALL each be reachable via Tab, activatable via Enter, and operable without a pointer device.
4. IF the input is empty when the user attempts to submit, THEN THE Landing_Page SHALL prevent navigation and display an inline validation message adjacent to the input indicating that a username is required.
5. IF the input contains a value that does not match the valid GitHub username format when the user attempts to submit, THEN THE Landing_Page SHALL prevent navigation and display an inline validation message adjacent to the input indicating that the username format is invalid.
