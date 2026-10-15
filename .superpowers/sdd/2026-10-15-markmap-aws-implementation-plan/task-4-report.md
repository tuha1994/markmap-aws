# Task 4 Report — Firestore repositories and owner-constrained subscriptions

## Delivered

- Added typed modular Firestore repositories for active owner-scoped folder and mind-map subscriptions.
- Added version-checked map writes, logical map archival, atomic map-plus-revision snapshots, and post-commit revision pruning with `revisionPrunePending` fallback.
- Added owner-verified folder relocation plus logical archival; destination folders are validated as active and same-owner.
- Added `useMindMapList` and reusable test data factories.
- Added repository tests using mocked modular SDK dependencies only; no Firebase production project was contacted.

## TDD evidence

Observed expected RED failures before implementations for:

- Missing map subscription repository module.
- Missing folder subscription repository module.
- Missing revision repository module.
- Missing versioned map update API.
- Missing folder relocation/archive API.
- Revision-prune failure behavior returning `prunePending: false` before the fallback implementation.
- Cross-owner destination-folder relocation returning `archived` before destination validation.

## Verification

- Focused repository tests: 6 files / 7 tests passed.
- Full unit suite: 15 files / 24 tests passed.
- Rules regression: 2 files / 10 tests passed with `FIRESTORE_EMULATOR_HOST=127.0.0.1:8085`.
- Typecheck, lint, build, and `git diff --check` passed.

## Environment note

`npm run test:rules` now starts its own Firestore Emulator through `firebase emulators:exec`, using the project-local configured port `8090` and test initialization that parses `FIRESTORE_EMULATOR_HOST` (with the same `127.0.0.1:8090` fallback). It no longer depends on a pre-existing emulator at port 8085.

## Review-fix evidence

### Strict RED → GREEN regressions

- **Folder relocation versioning and batching:** added an emulator-backed repository regression with 501 maps. RED returned a Rules `PERMISSION_DENIED` because relocation changed `folderId` without increasing `contentVersion`. GREEN relocates every map in 400-write chunks, increments each `contentVersion` from 1 to 2 exactly once, updates `updatedAt`, then archives only after all relocation batches succeed.
- **Autosave while prune is pending:** added an emulator-backed regression. RED created an `autosave` revision and returned `saved`; GREEN returns `{ status: 'prune-pending' }`, leaves the current map untouched, and creates no revision snapshot.
- **Prune query failure after commit:** added a repository regression whose RED rejected with `prune read denied`. GREEN preserves the committed map/revision transaction, best-effort marks `revisionPrunePending: true`, and returns `{ status: 'saved', prunePending: true }` rather than a misleading save failure.
- **Relocation chunk failure:** added a 401-map unit regression. RED returned `archived`; GREEN returns `{ status: 'partial', mapsMoved: 400, retryable: true }` when the later batch fails and does not archive the source folder.
- **Rename result:** added a regression whose RED returned `{ status: 'archived' }`; GREEN returns `{ status: 'renamed' }`.

### Final verification

- `npm test` — 16 files / 28 tests passed.
- `npm run test:rules` — self-contained Emulator execution; 3 files / 12 tests passed, including the two repository integration regressions.
- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run build` — passed (existing Vite chunk-size advisory only).
- `git diff --check` — passed.
