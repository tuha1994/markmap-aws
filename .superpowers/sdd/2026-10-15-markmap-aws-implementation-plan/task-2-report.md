# Task 2 Report — Firebase Auth and UID access gate

## Scope delivered

- Added the Firebase modular web SDK at the exact direct dependency version `firebase@13.0.0`, with `package-lock.json` updated.
- Added typed, public-only `VITE_FIREBASE_*` configuration validation and a singleton modular Firebase client boundary.
- Added popup-first Google sign-in, safe authentication error handling, Auth state observation, and authentication gating.
- Added read-only own-record authorization lookup at `authorizedUsers/{uid}`. No allow-list write/list operation is implemented.
- Added access gating that allows workspace composition only for an enabled own record and invokes the private-state/subscription cleanup boundary on sign-out, denial, or access-check failure.

## TDD evidence

Each behavior was introduced test-first and observed failing before its implementation:

- `AuthGate.test.tsx`: failed because `AuthGate` did not exist; passed after the signed-out Google action gate was implemented.
- `AuthProvider.test.tsx`: failed because `AuthProvider` did not exist; passed after Auth observer handling was implemented.
- `config.test.ts`: failed because Firebase config validation did not exist; passed after the typed public-config boundary was implemented.
- `client.test.ts`: failed because the Firebase client factory did not exist; passed after the modular client boundary was implemented.
- `authApi.test.ts`: failed because the popup auth adapter did not exist; passed after safe authorized-domain/popup error mapping was implemented.
- `accessRepository.test.ts`: failed because the own-record repository did not exist; passed after the direct own-document reader was implemented.
- `AccessGate.test.tsx`: failed because `AccessGate` did not exist; passed for absent and disabled records plus sign-out cleanup after the access gate was implemented.
- `App.test.tsx`: failed because the shell was not behind auth/access gates; passed after the gate composition was wired.

## Verification

- Focused auth/access: `npm test -- src/features/auth src/features/access` — passed (5 files, 6 tests before the final disabled-record parameterization; final focused AccessGate run passed 3 tests).
- Full suite: `npm test` — passed (9 files, 15 tests).
- `npm run lint` — passed.
- `npm run typecheck` — passed after adding typed Vite environment declarations.
- `npm run build` — passed. Vite reported the existing large-chunk advisory only; it is not a build failure.
- `npm ci` — passed using the updated lockfile.
- `git diff --check` — passed before staging.
- Static review found no added `eval`, `exec`, `innerHTML`, or `shell=True` usage.
- `npm audit --omit=dev --audit-level=high` reports four high-severity transitive advisories for `@grpc/grpc-js@1.9.16` beneath Firebase Firestore. npm's only proposed remediation is an unsafe forced downgrade to `firebase@9.14.0`; no dependency override or version change was made in this scoped task.

## Security review

- Firebase config reads only `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID`; no credentials were added.
- Google sign-in alone does not render the workspace. The gate reads exactly `authorizedUsers/{currentUser.uid}` and requires `enabled === true`.
- Browser code never creates, updates, deletes, or lists allow-list records.
- Access denial, access-read failure, and sign-out invoke the supplied private-state/subscription cleanup boundary.
- No Firebase resources, authorized domains, Rules, real popup, or deployment action was attempted.

## Configuration blockers

Actual-project Firebase popup/authorized-domain validation remains blocked because no Firebase project ID/config values, Google-provider enablement confirmation, authorized-domain confirmation for `tuha1994.github.io`, or real intended-user UID were supplied. A privileged operator must create or enable `authorizedUsers/{uid}` outside this browser application before real access validation.
