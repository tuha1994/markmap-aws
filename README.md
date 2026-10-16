# Markmap AWS

A private Markdown mind-map workspace built with React, Vite, and TypeScript.

## Local development

```bash
npm ci
npm run dev
```

Use the committed lockfile with `npm ci` for deterministic installs. Run `npm test`, `npm run test:rules`, `npm run test:e2e`, `npm run lint`, `npm run typecheck`, and `npm run build` before sharing changes. `npm run test:all` runs the unit, Rules, and headless Chromium browser suites together.

## Security and repository safety

Firebase web configuration is public client configuration used by the browser; it is not a secret and does not grant access by itself. Authentication and Firestore Rules remain the authorization boundary.

Do not commit secrets, service-account keys, AWS credentials, Firebase emulator data, exported maps, or AWS Partner/internal content. Production Firebase changes and GitHub Pages deployment require separate approval and are not performed by this project baseline.

## Firestore Emulator Rules tests

Rules tests run only against a dynamically configured local Firestore Emulator and never deploy Rules or contact a Firebase project:

```bash
npm run test:rules
```

## Browser E2E coverage

`npm run test:e2e` starts local Firebase Auth and Firestore Emulators, builds the application in `e2e` mode, serves that production build with `vite preview`, and runs headless Chromium. The browser suite uses real Auth Emulator email/password sessions only in the local emulator build; it does not bypass `AuthGate`, `AccessGate`, or Firestore Rules. It covers signed-in allow-list denial at a direct private entrypoint, an authorized 360px workspace's Maps/Edit/Preview panes, native Markmap rendering/fit behavior, and a real two-context versioned-save conflict resolved through `useSaveQueue`.

For a cache-independent local/CI run, use:

```bash
npm run ci:e2e:clean
```

That command performs `npm ci`, runs `playwright install chromium` through `npm run test:e2e:install` with a project-local browser path, then runs the E2E suite. The emitted-asset check enumerates text assets against a deliberately small fixture vocabulary for obvious credential and AWS Partner/internal markers; it is not a universal secret scanner.

Google popup sign-in cannot be safely automated without an approved non-production Firebase project and a privileged allow-list operator. Run that check manually only after obtaining approval: sign in with the Google popup against the approved test project, record the literal Authentication UID, create that UID's `authorizedUsers/{uid}` allow-list document out of band, then verify access and sign-out. Do not add test-project or production credentials to this repository.

## CI, Pages artifact, and rollback

`.github/workflows/ci.yml` runs on pull requests and `main` pushes. It uses `npm ci`, then linting, type checking, unit/integration tests, Firestore Rules tests, clean Chromium installation, headless E2E, and a Vite build. It has no Firebase production credentials or deployment step.

`.github/workflows/deploy-pages.yml` is deliberately `workflow_dispatch` only. An authorized release operator supplies an approved commit SHA, tag, or branch in `approved_ref`; the workflow repeats quality gates, builds only `dist/`, and uploads it as a GitHub Pages artifact in the protected `github-pages` environment. It does not invoke `actions/deploy-pages`, change Firebase, enable App Check, or automatically deploy from `main`.

Before the first approved artifact run, configure this repository's GitHub Pages source as **GitHub Actions** and protect the `github-pages` environment with the organization's required reviewers. The workflow runs with only `contents: read`, `pages: write`, and `id-token: write` permissions. GitHub's custom Pages workflow documentation describes `configure-pages`, `upload-pages-artifact`, and the protected environment/permissions required for a later deployment action.[1] The workflow uses the currently documented `actions/checkout@v6`, `actions/configure-pages@v5`, and `actions/upload-pages-artifact@v4` major versions.[1]

### Deferred production release and rollback

Production deployment remains outside this repository baseline. A separate release approval must identify the exact tested commit/artifact, target Pages environment, release operator, Firebase Rules version, App Check state, test UID/operator, and rollback target. Do not invoke `actions/deploy-pages` until that approval exists.

For an approved rollback, identify the last known-good immutable commit SHA or tag, re-run **Prepare GitHub Pages artifact** manually with that exact value in `approved_ref`, and obtain the same separate deployment authorization for the resulting artifact. Do not roll back by editing `main`, changing Firebase Rules, or enabling/disabling App Check. This procedure remains compatible with the Firebase Spark constraint because it uses static Pages artifacts and does not add a server or paid Firebase service.

## Privileged first UID grant runbook

The browser application cannot grant its own access. A privileged Firebase project operator performs the first grant only after the intended user has signed in with Google once in the approved Firebase project:

1. Obtain the literal Firebase Authentication UID from Firebase Authentication. Do not infer it from an email address.
2. In Firebase Console, create `authorizedUsers/{uid}` with this exact document shape:

   ```text
   enabled: true
   grantedAt: <Firestore Timestamp>
   grantedBy: <privileged operator identifier>
   ```

3. Validate the record in a non-production environment when available. Production creation requires the separate security/deployment approval gate; this repository does not deploy Rules or create allow-list records.
4. Have the user refresh or re-authenticate. Only an existing record with `enabled: true` permits browser data access.

To revoke access, the privileged operator sets `enabled` to `false` (or removes the record) outside the browser app. Browser clients cannot list, create, update, or delete `authorizedUsers` documents.

## Sources

[1] https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
