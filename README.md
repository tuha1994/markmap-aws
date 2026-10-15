# Markmap AWS

A private Markdown mind-map workspace built with React, Vite, and TypeScript.

## Local development

```bash
npm ci
npm run dev
```

Use the committed lockfile with `npm ci` for deterministic installs. Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build` before sharing changes.

## Security and repository safety

Firebase web configuration is public client configuration used by the browser; it is not a secret and does not grant access by itself. Authentication and Firestore Rules remain the authorization boundary.

Do not commit secrets, service-account keys, AWS credentials, Firebase emulator data, exported maps, or AWS Partner/internal content. Production Firebase changes and GitHub Pages deployment require separate approval and are not performed by this project baseline.

## Firestore Emulator Rules tests

Rules tests run only against a dynamically configured local Firestore Emulator and never deploy Rules or contact a Firebase project:

```bash
npm run test:rules
```

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
