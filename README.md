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
