# Task 10 Report — Markdown Import and Export

## Completed

- Added local/browser-only Markdown import with `.md` validation, strict UTF-8 decoding, exact 256 KiB UTF-8 validation, and filename-derived map titles.
- Added an explicit import confirmation dialog. Import always creates a new map and never overwrites the selected map.
- Preserved unsaved-draft protection by disabling import until the selected map is saved.
- Added browser download export for the exact current editor draft with sanitized `.md` filenames.
- Import parsing and export download use browser APIs; after confirmation, import creates a new map through configured Firestore persistence, with no arbitrary external file upload, analytics, or logging.

## TDD Evidence

- RED: focused import/export tests failed because `importMarkdown` and `exportMarkdown` did not exist.
- RED: import-dialog tests failed because `ImportDialog` did not exist.
- RED: workspace flow test failed because the import action did not exist.
- GREEN: each focused suite passed after the corresponding minimal implementation.

## Verification

- Focused Task 10 tests: `npm test -- src/features/editor/importMarkdown.test.ts src/features/editor/exportMarkdown.test.ts src/features/editor/ImportDialog.test.tsx src/app/Workspace.test.tsx` — 4 files, 15 tests passed.
- Editor suite: `npm test -- src/features/editor` — 8 files, 22 tests passed.
- Full unit suite: `npm test` — 41 files, 101 tests passed.
- Rules: `npm run test:rules` — 4 files, 14 tests passed in the Firestore Emulator.
- `npm run lint`, `npm run typecheck`, `npm run build`, and `git diff --check` passed.
- Build retains the existing Vite >500 kB chunk advisory.

## Scope

No Firebase production calls, deployment, App Check work, external services, or Task 11+ work were performed.

## Review Fixes

- The confirmation handler now re-checks the active save status immediately before creating or selecting an imported map. If the draft became unsaved, saving, offline-pending, conflicted, errored, or prune-pending after the dialog opened, it retains the draft and reports that it must be saved first.
- Filename-derived import titles are NFC-normalized, reject control and bidirectional characters, and reject values longer than the Firestore rule's 120-character title limit before confirmation can create a map.
- Export filenames preserve Markdown bytes exactly while safely falling back for Windows reserved basenames, control/bidirectional characters, and empty/invalid trailing-dot-or-space basenames.
- The browser handles local parsing/download; confirmed imports create maps through configured Firestore persistence only, without arbitrary external file upload, analytics, or logging.

## Review Verification

- Focused review tests: `npm test -- src/app/Workspace.test.tsx src/features/editor/ImportDialog.test.tsx src/features/editor/importMarkdown.test.ts src/features/editor/exportMarkdown.test.ts` — 4 files, 21 tests passed.
- Full unit suite: `npm test` — 41 files, 107 tests passed.
- Rules: `npm run test:rules` — 4 files, 14 tests passed in the Firestore Emulator.
- `npm run lint`, `npm run typecheck`, and `git diff --check` passed.
- `npm run build` passed with the existing Vite >500 kB chunk advisory.

## Superscript Reserved-Device Follow-up

- RED: Added a focused export-filename regression test for `COM¹`, `com².md`, `LPT³.txt`, and `lpt¹. `; it failed because the ASCII-only device-name matcher returned `COM¹.md`.
- GREEN: Extended the reserved-device matcher to treat Windows-recognized superscript port digits `¹`, `²`, and `³` as reserved for `COM` and `LPT`, including extension and post-canonicalization trailing suffix cases.
- Verification: focused export test passed (4 tests); full unit suite passed (41 files, 108 tests); rules passed (4 files, 14 tests); lint, typecheck, build, and `git diff --check` passed. Build retains the existing Vite >500 kB chunk advisory.
