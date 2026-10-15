# Task 1 Report — Bootstrap the Vite React TypeScript project and repository safety baseline

## TDD evidence

### RED

Command:

```bash
npm test -- src/app/App.test.tsx src/lib/markdown/byteLength.test.ts
```

Result: failed as expected before the project baseline existed. npm exited with code 127 and reported `ENOENT` for the missing `package.json`. The tests had already been written and imported the absent `App` and `utf8ByteLength` interfaces. A second RED run after adding the exact-256-KiB Unicode boundary test produced the same expected missing-manifest failure.

### GREEN

Command:

```bash
npm test -- src/app/App.test.tsx src/lib/markdown/byteLength.test.ts
```

Result: passed after the minimal implementation and test baseline were added.

```text
Test Files  2 passed (2)
Tests       3 passed (3)
```

## Verification

Focused verification command:

```bash
npm test -- src/app/App.test.tsx src/lib/markdown/byteLength.test.ts && npm run typecheck && npm run build && git diff --check
```

Result: passed. Vitest reported 2 files / 3 tests passing; `tsc --noEmit` passed; `vite build` passed; and `git diff --check` passed.

Full-suite command:

```bash
npm test
```

Result: passed: 2 files / 3 tests.

Lint command:

```bash
npm run lint
```

Result: passed.

Build output verification: `dist/index.html` references `/markmap-aws/assets/index-C46Ah27a.js`, confirming the required Pages base path.

Install verification: generated and committed `package-lock.json`; `npm ci` completed successfully after the lockfile existed, auditing 191 packages with 0 vulnerabilities reported by npm.

## Files changed

- `.env.example`
- `.gitignore`
- `README.md`
- `eslint.config.mjs`
- `index.html`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `vite.config.ts`
- `src/main.tsx`
- `src/app/App.tsx`
- `src/app/App.test.tsx`
- `src/lib/markdown/byteLength.ts`
- `src/lib/markdown/byteLength.test.ts`
- `src/test/setup.ts`

## Commit

`59cc787b1f4464cae117992299c072675c60de63` — `chore: bootstrap secure Vite application`

## Self-review

- Vite production base is exactly `/markmap-aws/`.
- Direct dependency versions are all exact; the package lockfile is committed; `ci:install` uses `npm ci`.
- The baseline does not clone, vendor, or load Markmap from a CDN.
- `utf8ByteLength` uses `TextEncoder` and its tests cover multi-byte Unicode plus the exact 262,144-byte boundary.
- Repository safety exclusions were verified for `.worktrees`, `.env` files while retaining `.env.example`, service accounts, exports, emulator data, and internal-content paths.
- README distinguishes public Firebase client configuration from prohibited secrets and content.
- No Firebase contact, Firebase configuration, production Rules/App Check action, or Pages deployment was performed.

## Unresolved concerns

- None for Task 1. Firebase configuration, Rules, emulator integration, Markmap integration, and deployment remain intentionally deferred to their respective future tasks and approval gates.

## Review-fix round

### Corrective TDD evidence

The prior RED evidence only established that the manifest was absent; it did not exercise a size-validator API. This corrective cycle used a real behavior test first.

#### RED

Added this test before adding `isMarkdownWithinLimit`:

```ts
expect(isMarkdownWithinLimit('a'.repeat(262_145))).toBe(false);
```

Command:

```bash
npm test -- src/lib/markdown/byteLength.test.ts
```

Result: failed as expected because the new export had no implementation:

```text
Test Files  1 failed (1)
Tests       1 failed | 2 passed (3)
TypeError: isMarkdownWithinLimit is not a function
```

#### GREEN

Implemented the smallest validator using the existing `utf8ByteLength`/`TextEncoder` byte counter and a `256 * 1024` byte limit.

Focused command:

```bash
npm test -- src/lib/markdown/byteLength.test.ts
```

Result: passed — 1 file / 3 tests.

### Firebase Admin SDK ignore verification

Command:

```bash
git check-ignore -v --no-index example-firebase-adminsdk-abc12-1234567890.json
git check-ignore -q --no-index .env.example
git check-ignore -q --no-index project-settings.json
```

Result: the exact Admin SDK example is ignored by `*-firebase-adminsdk-*.json`; `.env.example` and an ordinary project JSON file are not ignored.

### Full verification

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Result: all passed. Full Vitest suite: 2 files / 4 tests. The production build retained the `/markmap-aws/` asset base path.

Range whitespace check (after commit):

```bash
git diff --check 59cc787b1f4464cae117992299c072675c60de63...HEAD
```

Result: passed.

### Corrective files changed

- `.gitignore`
- `src/lib/markdown/byteLength.ts`
- `src/lib/markdown/byteLength.test.ts`
- `.superpowers/sdd/2026-10-15-markmap-aws-implementation-plan/task-1-report.md`

### Corrective commit

`fix: address Task 1 review findings` — committed locally; final commit identifier is recorded in Git history.

### Corrective self-review

- The validator measures UTF-8 bytes through the existing `TextEncoder` helper and rejects the required 262,145-byte ASCII input.
- The Firebase Admin SDK pattern is filename-specific and does not ignore all JSON files.
- `.env.example` remains explicitly unignored.
- No future-task behavior was added.
