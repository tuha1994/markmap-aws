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

`firebase emulators:exec` could not start because port 8085 was already occupied. The existing emulator responded when explicitly targeted through `FIRESTORE_EMULATOR_HOST=127.0.0.1:8085`, and the Rules suite passed there.
