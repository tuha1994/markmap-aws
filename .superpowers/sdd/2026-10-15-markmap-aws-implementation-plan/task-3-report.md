# Task 3 Report — Firestore schema, Rules, indexes, and first-grant runbook

## Delivered

- Added Firestore schema types for `Folder`, `MindMap`, and `Revision`/`RevisionReason` matching Spec Section 7.
- Added default-deny `firestore.rules` with UID allow-list checks, immutable owner fields, active owner-scoped reads, logical folder archive/map delete transitions, no browser map/folder physical deletes, revision create-only writes, active-parent revision access, field/type/key validation, same-owner active-folder references, and exact `value.toUtf8().size() <= 262144` Markdown/search-text limits.
- Added checked-in composite indexes for active map/folder lists and disabled single-field indexes for `markdown` and `contentSearchText`.
- Added Firebase Emulator configuration and a dedicated Rules-test Vitest config/script.
- Added direct client-SDK Emulator Rules tests plus an index-file contract test.
- Documented the privileged, Console-only first UID grant and revocation procedure. No Firebase project, Rules deployment, or production operation was performed.

## TDD evidence

- Rules test files were written before `firestore.rules`, `firestore.indexes.json`, and `firebase.json` existed.
- Initial Rules run failed because `firestore.rules` was absent; the index contract test failed because `firestore.indexes.json` was absent.
- The owner-UID immutability test was observed failing after the immutable owner predicates were removed, then passed after the minimal predicates were restored.
- After the minimal Rules/config/index implementation, the local Emulator Rules suite passed.

## Verification

- `npm ci` — passed.
- Local Firestore Emulator only:
  - `npx firebase emulators:exec --only firestore "npm run test:rules"` — passed: 2 files, 9 tests.
  - Focused direct-SDK Rules rerun with both Rules test files — passed: 2 files, 9 tests.
- `npm test -- src/lib/markdown/byteLength.test.ts` — passed: 1 file, 3 tests.
- `npm test` — passed: 10 files, 18 tests (includes the Firestore index contract test; Rules tests intentionally run only through the Emulator script).
- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run build` — passed; Vite emitted its existing >500 kB chunk advisory only.
- `git diff --check` — passed.
- Self-review static scan found no hardcoded secrets or unsafe eval/exec/shell patterns.

## Files changed

- `firestore.rules`, `firestore.indexes.json`, `firebase.json`, `vitest.rules.config.ts`
- `src/features/folders/folderTypes.ts`
- `src/features/mindmaps/mindMapTypes.ts`
- `src/features/history/revisionTypes.ts`
- `src/test/rules/authorizedUsers.rules.test.ts`
- `src/test/rules/ownerData.rules.test.ts`
- `src/test/firestoreIndexes.contract.test.ts`
- `src/lib/markdown/byteLength.ts`
- `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `README.md`

## Blockers/issues

- No task blocker remains.
- The host runs Node `v26.7.0`; `superstatic@10.0.0` warns it supports Node 20/22/24. Local Firestore Emulator tests nevertheless started and passed.
- `npm ci` reports 12 dependency-audit findings (4 moderate, 8 high) in the installed dependency graph; no forced upgrade/downgrade was applied because it would exceed this scoped task.
