# Markmap AWS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a private, Firebase Spark-compatible React application for multiple Markdown mind maps, rendered through official Markmap packages and synchronized securely through Firebase Authentication, Firestore, and GitHub Pages.

**Architecture:** A Vite React SPA at `/markmap-aws/` uses Google Firebase Authentication plus an explicit Firestore UID allow-list. Owner-scoped folders/maps/revisions are enforced by default-deny Rules. `markmap-lib` transforms Markdown and `markmap-view` owns the interactive SVG. Static assets deploy through GitHub Actions to GitHub Pages only after release approval.

**Tech Stack:** React, Vite, TypeScript, Firebase modular Web SDK, `markmap-lib`, `markmap-view`, Vitest, Testing Library, `@firebase/rules-unit-testing`, Firebase Emulator Suite, Playwright, GitHub Actions, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-15-markmap-aws-design.md`

## Global Constraints

- Implement only after the Specification and this plan are approved.
- Vite production base must be `/markmap-aws/`.
- Use npm packages `markmap-lib` and `markmap-view` only; never clone, fork, vendor, or copy Markmap source.
- Preserve Markmap-native rendering, wheel zoom, drag pan, and expand/collapse. Do not write a replacement SVG interaction engine.
- Use Firebase Authentication Google provider and Cloud Firestore; no server, Cloud Functions, Cloud Run, Firebase Storage, external search service, or paid-only Firebase dependency.
- Only an enabled `authorizedUsers/{uid}` record plus document ownership may grant application data access.
- Never use `allow read, write: if true`, authentication-only data access, browser self-provisioning, or a public wildcard path.
- Do not commit service-account keys, AWS credentials, internal AWS Partner content, map exports, private test fixtures, or production-only configuration.
- Production Firestore Rules, App Check enforcement, and Pages deployment each require separate approval.
- Markdown content is capped at exactly 256 KiB UTF-8 bytes in both client validation and Rules through `TextEncoder`/`String.toUtf8().size()`; retain at most 50 immutable revisions per map except temporary retention of 51 while safe pruning is pending.
- Pin exact npm dependency versions, commit `package-lock.json`, use `npm ci` in CI, and never use CDN `latest` or automatic Markmap upgrades.

## Execution Phases and Dependencies

| Phase | Tasks | Depends on | Deliverable |
| --- | --- | --- | --- |
| 0 — Security foundation | 1–4 | Task 1: Spec/Plan approval; Tasks 2–4: Firebase configuration and test UID/operator details | Secure baseline, Auth, Rules, emulator evidence |
| 1 — Core authoring | 5–7 | Phase 0 | Responsive map workspace, save/sync/conflict, Markmap |
| 2 — Knowledge management | 8–10 | Phase 1 | Search, folders, history/restore, import/export |
| 3 — Release readiness | 11–13 | Phases 0–2 | E2E evidence, API/App Check assessment, guarded Pages workflow/rollback runbook |

## File Structure

```
.github/workflows/ci.yml                    quality workflow
.github/workflows/deploy-pages.yml          approved Pages deployment workflow
.env.example                                public Firebase variable names only
.gitignore                                  secrets/content/build exclusions
firebase.json                               Emulator configuration
firestore.rules                             default-deny authorization rules
firestore.indexes.json                      versioned composite/index exemptions
index.html                                  Vite entry HTML
package.json                                scripts/dependencies
playwright.config.ts                        browser E2E configuration
vite.config.ts                              React/Vite config with Pages base
src/app/                                    providers, routes, App shell
src/features/auth/                          Google auth and allow-list gate
src/features/access/                        allow-list types/read model
src/features/folders/                       folders/sidebar commands
src/features/mindmaps/                      map models/repository/list/search
src/features/editor/                        editor, save queue, import/export
src/features/preview/                       Markmap adapter/assets/toolbar
src/features/history/                       immutable revisions/restore
src/components/                             accessible dialogs/feedback/layout
src/lib/firebase/                           typed Firebase SDK boundary
src/lib/markdown/                           byte validation/search/file helpers
src/test/                                   unit/component/integration/Rules helpers
e2e/                                       Playwright workflows
docs/security/                              API key/App Check assessment records
README.md                                  setup, first UID grant, release runbook
```

## Requirement → Implementation Task → Test → Acceptance Criteria

| Requirement | Tasks | Test evidence | Acceptance criterion |
| --- | --- | --- | --- |
| Google Sign-in | 2 | Auth unit/component, browser popup QA | Google popup signs in, sign-out clears private state, failed popup is recoverable. |
| UID allow-list | 3–4 | Rules emulator direct SDK matrix | No unauthenticated/unapproved/disabled UID reads or writes data. |
| Multiple map CRUD | 4, 7 | Repository/component/integration tests | Owner creates/views/renames/updates/deletes only their own maps. |
| Markdown + live preview | 5 | Adapter/component/browser security tests | Markdown update produces official Markmap SVG without reload and cannot execute unsafe Markdown payloads. |
| Native zoom/pan/expand-collapse | 5, 11 | Browser E2E/manual QA | Native Markmap interactions work after repeated edits/map switches. |
| Firestore save/sync | 4, 6, 9 | Repository/save queue/integration tests | Saved state reflects confirmed write, map+snapshot is atomic, pruning cannot lose an old snapshot, and data syncs between clients. |
| Unsaved/error/conflict states | 6 | Fake timer/deferred-promise/component/E2E tests | No late write marks newer draft saved; both conflicting values are preserved. |
| Search | 8 | Unit/component/integration test | Owner-local title/content search ranks title matches first and leaks no other owner data. |
| Folders | 4, 7–8 | Rules/repository/dialog tests | Folder organization works; non-empty delete moves maps or cancels. |
| Version history/restore | 9 | Revision/Rules/integration tests | Immutable revisions, 50-cap cleanup, protected restore, no revision mutation. |
| Import/export Markdown | 10 | File validation/browser download tests | Valid import creates new map; invalid file never writes; export equals editor text. |
| Responsive UI | 7, 11 | Component viewport/Playwright tests | 1280 desktop panes and 360 mobile tabs are usable. |
| GitHub Pages Actions | 13 | Workflow/build/manual test-project artifact review | Build uses `/markmap-aws/`, guarded Pages artifact workflow and rollback runbook are verified without production deploy. |
| Public-repository data safety | 1, 11–13 | Secret scans/review checklist | No internal content/credentials enter tracked files or bundles. |
| API restriction/App Check | 12 | Operator review record | API key review and App Check assessment completed without production enforcement. |

---

## Phase 0 — Security Foundation

### Task 1: Bootstrap the Vite React TypeScript project and repository safety baseline

**Dependencies:** User approves Spec/Plan and authorizes source creation.

**Files:**
- Create: `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/app/App.tsx`, `src/test/setup.ts`, `.gitignore`, `.env.example`, `README.md`
- Create: `src/app/App.test.tsx`, `src/lib/markdown/byteLength.ts`, `src/lib/markdown/byteLength.test.ts`

**Interfaces:**
- `App(): JSX.Element` renders semantic `<main>`.
- `utf8ByteLength(value: string): number` supports 256 KiB validation.

- [ ] **Step 1: Write failing application and byte-limit tests**

```tsx
it('renders the application shell', () => {
  render(<App />);
  expect(screen.getByRole('main')).toBeInTheDocument();
});
```

```ts
it('counts UTF-8 bytes rather than JavaScript code units', () => {
  expect(utf8ByteLength('é')).toBe(2);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/app/App.test.tsx src/lib/markdown/byteLength.test.ts`
Expected: FAIL because project files do not exist.

- [ ] **Step 3: Create baseline and safety configuration**

Configure Vite React TypeScript with `base: '/markmap-aws/'`, Vitest/jsdom, Testing Library, lint/typecheck scripts, and production build. Install direct dependencies with exact versions, commit the generated `package-lock.json`, and define `npm ci` as the CI install command; do not use CDN `latest` or version ranges for Markmap packages. Add ignore entries for `.env*` except `.env.example`, Firebase service accounts, exports, local emulator data, and any internal-content paths. README must state that Firebase web config is public client config, but secrets/content are prohibited.

- [ ] **Step 4: Verify baseline**

Run: `npm test -- src/app/App.test.tsx src/lib/markdown/byteLength.test.ts && npm run typecheck && npm run build && git diff --check`
Expected: PASS; built asset paths start with `/markmap-aws/`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.ts tsconfig.json index.html src .gitignore .env.example README.md
git commit -m "chore: bootstrap secure Vite application"
```

**Acceptance criteria:** The project builds at the Pages base path, supports tests, and excludes prohibited secrets/content.

### Task 2: Implement Google Firebase Authentication and authorization gates

**Dependencies:** Task 1; Firebase project config; Google provider enabled; `tuha1994.github.io` authorized; first intended user can establish UID.

**Files:**
- Create: `src/lib/firebase/config.ts`, `src/lib/firebase/client.ts`
- Create: `src/features/auth/AuthProvider.tsx`, `src/features/auth/authApi.ts`, `src/features/auth/AuthGate.tsx`
- Create: `src/features/access/AccessGate.tsx`, `src/features/access/accessRepository.ts`, `src/features/access/accessTypes.ts`
- Test: `src/features/auth/AuthProvider.test.tsx`, `src/features/auth/AuthGate.test.tsx`, `src/features/access/AccessGate.test.tsx`

**Interfaces:**
- `useAuth(): { phase: 'loading' | 'signedOut' | 'signedIn' | 'error'; user: User | null; signIn(): Promise<void>; signOut(): Promise<void> }`
- `getOwnAuthorization(uid: string): Promise<AuthorizedUser | null>`.
- `AuthorizedUser = { enabled: boolean; grantedAt: Timestamp; grantedBy: string }`.

- [ ] **Step 1: Write failing sign-in/access-gate tests**

```tsx
it('shows the Google sign-in action while signed out', () => {});
it('opens unauthorized state for an absent or disabled allow-list record', async () => {});
it('clears private state and subscriptions on sign-out', async () => {});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/features/auth src/features/access`
Expected: FAIL because Firebase auth/access components do not exist.

- [ ] **Step 3: Implement popup-first Google sign-in**

Initialize Firebase once from typed `VITE_FIREBASE_*` values. Implement `signInWithPopup` as primary; map popup/authorized-domain errors to safe retry messages. Evaluate redirect fallback only after mobile/GitHub Pages QA. Observe auth state before rendering private UI. Read only the caller’s `authorizedUsers/{uid}` record and stop all data subscriptions on sign-out/denial.

- [ ] **Step 4: Verify Auth behavior**

Run: `npm test -- src/features/auth src/features/access && npm run build`
Expected: PASS with mocked modular SDK adapters.

- [ ] **Step 5: Commit**

```bash
git add src/lib/firebase src/features/auth src/features/access src/app
git commit -m "feat: add Google auth and UID access gate"
```

**Acceptance criteria:** Google Auth is not sufficient by itself; only enabled allow-listed UIDs reach workspace composition.

### Task 3: Implement Firestore schema, default-deny Rules, and privileged first-grant runbook

**Dependencies:** Task 2; no actual production UID is required for Emulator Rules tests. A privileged operator/real UID is required only for non-production live grant validation.

**Files:**
- Create: `firestore.rules`, `firestore.indexes.json`, `firebase.json`
- Create: `src/features/folders/folderTypes.ts`, `src/features/mindmaps/mindMapTypes.ts`, `src/features/history/revisionTypes.ts`
- Create: `README.md` sections for first UID grant/runbook
- Test: `src/test/rules/authorizedUsers.rules.test.ts`, `src/test/rules/ownerData.rules.test.ts`, `src/test/firestoreIndexes.contract.test.ts`

**Interfaces:**
- `Folder`, `MindMap`, and `Revision` types exactly match Spec Section 7.
- Rules helpers `approvedUid()`, `ownsExisting()`, `ownsCreate()`, validated-key/type/immutability predicates.

- [ ] **Step 1: Write failing direct-SDK Rules tests**

```ts
it('denies unauthenticated, unapproved, and disabled user access', async () => {});
it('denies browser list/create/update/delete access to authorizedUsers', async () => {});
it('denies cross-owner direct document access and unconstrained owner query', async () => {});
it('accepts 256 KiB UTF-8 ASCII and Unicode Markdown and rejects values above 262144 bytes through Rules', async () => {});
it('denies physical map/folder deletes, archived/deleted-object reads, and permits owner logical archive transitions', async () => {});
it('permits valid owner-constrained map and folder access', async () => {});
it('declares every active-list multi-field query in firestore.indexes.json', () => {});
```

- [ ] **Step 2: Run Rules tests to verify failure**

Run: `firebase emulators:exec --only firestore "npm run test:rules -- src/test/rules/authorizedUsers.rules.test.ts src/test/rules/ownerData.rules.test.ts"`
Expected: FAIL because Rules/schema do not exist.

- [ ] **Step 3: Implement Rules and checked-in indexes**

Write default-deny Rules. Allow only own `authorizedUsers/{uid}` get after `approvedUid`; deny all browser mutations/lists. Require `approvedUid` plus immutable owner UID and owner-constrained active-query semantics for folders/maps/revisions. Validate same-owner non-archived folder references, allowed fields, and exact `value.toUtf8().size() <= 262144` caps for Markdown/search text, revision create-only behavior, logical archive/delete transitions, and safe revision pruning. Deny physical map/folder root deletes. Disable single-field indexes for Markdown/search text. Declare the exact active map index `ownerUid ASC, deletedAt ASC, updatedAt DESC` and active folder index `ownerUid ASC, archivedAt ASC, sortOrder ASC`; add a contract test that parses `firestore.indexes.json`, because Emulator success alone is not evidence that production composite indexes exist.

- [ ] **Step 4: Verify Rules evidence**

Run: `firebase emulators:exec --only firestore "npm run test:rules"`
Expected: PASS; all required denial cases issue direct Firebase client operations, not Admin SDK operations.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules firestore.indexes.json firebase.json src/features/folders src/features/mindmaps src/features/history src/test/rules README.md
git commit -m "feat: define secure Firestore ownership model"
```

**Acceptance criteria:** Rules default-deny, UID allow-list/owner checks work in Emulator, and first UID grant is documented as a privileged operation.

### Task 4: Build Firestore repositories and owner-constrained live subscriptions

**Dependencies:** Task 3.

**Files:**
- Create: `src/features/folders/folderRepository.ts`, `src/features/mindmaps/mindMapRepository.ts`, `src/features/history/revisionRepository.ts`
- Create: `src/features/mindmaps/useMindMapList.ts`, `src/test/factories.ts`
- Test: repository unit/integration tests under feature directories

**Interfaces:**
- `subscribeFolders(ownerUid, listener): Unsubscribe`
- `subscribeMindMaps(ownerUid, listener): Unsubscribe`
- `subscribeMindMap(mapId, listener): Unsubscribe`
- `createMindMap(input): Promise<MindMap>`, `updateMindMapVersioned(input): Promise<UpdateResult>`
- `createFolder`, `renameFolder`, `moveMapsAndArchiveFolder`, `archiveMindMap`

- [ ] **Step 1: Write failing repository tests**

```ts
it('queries maps with ownerUid equality and updatedAt ordering', () => {});
it('uses a transaction version check for map updates', async () => {});
it('moves contained maps before archiving a folder', async () => {});
it('commits current map update and new revision atomically before attempting prune', async () => {});
it('keeps all revisions and marks prune pending if oldest-revision deletion fails', async () => {});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/features/folders src/features/mindmaps src/features/history`
Expected: FAIL because repositories do not exist.

- [ ] **Step 3: Implement typed modular-SDK repositories**

Every active-list query includes owner UID plus `deletedAt == null` or `archivedAt == null` as appropriate. Use transactions for content version writes, owner-verified batches for folder relocation, and small verified batches for revision cleanup. Browser delete commands perform logical map archival/folder archival; physical root deletes are absent from the repository API. Repository API returns typed conflict/error result instead of swallowing Firestore failures.

- [ ] **Step 4: Verify repository behavior**

Run: `npm test -- src/features/folders src/features/mindmaps src/features/history && npm run test:rules`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/folders src/features/mindmaps src/features/history src/test
git commit -m "feat: add owner-scoped Firestore repositories"
```

**Acceptance criteria:** All live queries and writes are owner-scoped, unsubscribe safely, and direct SDK physical map/folder deletes are denied without orphaning revisions or dangling security state.

## Phase 1 — Core Authoring

### Task 5: Implement Markmap lifecycle, official asset loading, and live preview

**Dependencies:** Task 1.

**Files:**
- Create: `src/features/preview/markmapAdapter.ts`, `src/features/preview/markmapAssets.ts`, `src/features/preview/markdownRenderSecurity.ts`, `src/features/preview/MarkmapPreview.tsx`, `src/features/preview/PreviewToolbar.tsx`
- Create: `src/features/editor/MarkdownEditor.tsx`
- Test: adapter/assets/preview/editor test files

**Interfaces:**
- `createMarkmapAdapter(svg: SVGSVGElement): { render(markdown: string): RenderResult; fit(): void; zoomIn(): void; zoomOut(): void; reset(): void; destroy(): void }`
- `loadMarkmapAssets(assets: MarkmapAssets): Promise<void>`.

- [ ] **Step 1: Write failing preview lifecycle tests**

```ts
it('uses markmap-lib output before rendering with markmap-view', () => {});
it('deduplicates transformer-reported assets', async () => {});
it('retains the previous valid SVG when transform fails', async () => {});
it('destroys the view and timers on unmount', () => {});
it('renders raw HTML and script-like Markdown as inert text', () => {});
it('removes unsafe URL schemes and replaces external images without network fetches', () => {});
it('rejects arbitrary user-supplied asset descriptors', async () => {});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/features/preview src/features/editor/MarkdownEditor.test.tsx`
Expected: FAIL because adapter/editor do not exist.

- [ ] **Step 3: Implement official Markmap boundary**

Before transform, pass Markdown through `sanitizeMarkdownForMarkmap(markdown: string): string`: escape raw HTML; remove non-HTTP(S) URL schemes; replace image syntax with inert alt text; and preserve safe Markdown hierarchy. Transform only that safe result through `markmap-lib`. Load only reviewed package-generated assets through a dedicated deduplicating loader and render/update via `markmap-view`; never insert user Markdown with `innerHTML`. Debounce transforms 300 ms. Delegate toolbar calls to official view APIs; do not implement custom graph interactions. Maintain source text and last valid SVG when transform errors occur.

- [ ] **Step 4: Verify preview**

Run: `npm test -- src/features/preview src/features/editor/MarkdownEditor.test.tsx && npm run build`
Expected: PASS.

Manual browser check: wheel zoom, drag pan, expand/collapse, fit, reset, repeated edits, map switch, and unmount all work.

- [ ] **Step 5: Commit**

```bash
git add src/features/preview src/features/editor package.json package-lock.json
git commit -m "feat: add official Markmap preview"
```

**Acceptance criteria:** Markmap interactions remain native and functional after live source updates without library-source copying, raw HTML/XSS payloads remain inert, unsafe URL schemes are removed, external images do not auto-fetch, and arbitrary assets cannot load.

### Task 6: Implement save queue, unsaved protection, sync status, and multi-device conflict resolution

**Dependencies:** Tasks 4–5.

**Files:**
- Create: `src/features/editor/useSaveQueue.ts`, `src/features/editor/useDirtyGuard.ts`, `src/features/editor/SaveStatus.tsx`, `src/features/editor/ConflictDialog.tsx`
- Test: save queue/dirty guard/conflict tests

**Interfaces:**
- `SaveStatus = 'saved' | 'saving' | 'unsaved' | 'offlinePending' | 'error' | 'conflict'`
- `useSaveQueue(map, repository): { draft; setDraft; status; retry(); saveVersion(); resolveConflict(choice); }`

- [ ] **Step 1: Write failing race/offline/conflict tests**

```ts
it('does not mark draft generation N+1 saved when N resolves late', async () => {});
it('starts autosave after 1.5 seconds idle', async () => {});
it('retains local and remote Markdown when a dirty editor receives a new remote version', async () => {});
it('adds beforeunload protection only while content is unsaved', () => {});
it('labels in-memory offline draft as not recoverable after refresh or browser crash', () => {});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/features/editor/useSaveQueue.test.ts src/features/editor/useDirtyGuard.test.tsx src/features/editor/ConflictDialog.test.tsx`
Expected: FAIL because synchronization state does not exist.

- [ ] **Step 3: Implement serialized versioned saves**

Increment `draftGeneration` per edit, serialize writes per map, transact on `contentVersion`, expose offline/retry errors without dropping content during the current page session, and only mark matching confirmed generation saved. Present explicit Keep mine/Use remote conflict choices. Keep mine replays through transaction after confirmation; Use remote replaces only after confirmation. Do not claim refresh/tab close/browser crash recovery: show a clear in-memory-only offline-draft warning and beforeunload protection.

- [ ] **Step 4: Verify synchronization protection**

Run: `npm test -- src/features/editor/useSaveQueue.test.ts src/features/editor/useDirtyGuard.test.tsx src/features/editor/ConflictDialog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/editor
git commit -m "feat: protect synchronized Markdown drafts"
```

**Acceptance criteria:** No silent data loss occurs from late writes, save failure during the active session, or competing device updates. Offline drafts are explicitly labeled in-memory-only; refresh, closing a tab, or browser crash are documented as possible loss events rather than falsely guaranteed recovery.

### Task 7: Compose responsive private workspace and basic map CRUD

**Dependencies:** Tasks 2, 4–6.

**Files:**
- Create: `src/components/layout/AppShell.tsx`, `src/components/layout/ResponsivePaneTabs.tsx`, `src/components/feedback/*`
- Create: `src/features/mindmaps/MapList.tsx`, `MapActions.tsx`, `src/features/folders/FolderSidebar.tsx`
- Modify: `src/app/App.tsx`, `src/styles/*`
- Test: workspace/layout/map CRUD components

**Interfaces:**
- `AppShell({ sidebar, editor, preview }): JSX.Element`
- `ResponsivePaneTabs({ maps, editor, preview }): JSX.Element`

- [ ] **Step 1: Write failing workflow/UI tests**

```tsx
it('lets an approved user create, select, rename, and archive an owned map', async () => {});
it('shows Maps/Edit/Preview accessible tabs on a mobile viewport', () => {});
it('shows loading, unauthorized, save error, and unsaved states without private payload leaks', () => {});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/app src/components/layout src/features/mindmaps`
Expected: FAIL because workspace composition is absent.

- [ ] **Step 3: Implement workspace composition**

Compose only approved user data. Provide create/edit/logical-delete confirmations, robust empty states, header status, desktop three-pane layout, and mobile tabs. Ensure sign-out/unauthorized transition tears down all subscriptions and clears map state.

- [ ] **Step 4: Verify workspace**

Run: `npm test -- src/app src/components/layout src/features/mindmaps && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app src/components src/features/mindmaps src/features/folders src/styles
git commit -m "feat: add responsive private map workspace"
```

**Acceptance criteria:** Approved owners manage multiple active maps from desktop/mobile workspace, logical deletion removes a map from active lists without deleting its revision parent, and all loading/error/unsaved states are distinguishable.

## Phase 2 — Knowledge Management

### Task 8: Complete folder operations and private map-content search

**Dependencies:** Tasks 4 and 7.

**Files:**
- Create: `src/features/mindmaps/search.ts`, `MapSearch.tsx`
- Create: `src/features/folders/DeleteFolderDialog.tsx`
- Test: search/folder dialog/repository tests

**Interfaces:**
- `searchMindMaps(maps: MindMap[], query: string): SearchResult[]`
- `moveMapsAndArchiveFolder(folderId: string, destinationFolderId: string | null): Promise<void>`

- [ ] **Step 1: Write failing search/folder tests**

```ts
it('ranks exact/prefix title matches above Markdown content matches', () => {});
it('searches only maps supplied by owner-scoped subscription', () => {});
it('requires a destination or cancellation before archiving a non-empty folder', async () => {});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/features/mindmaps/search.test.ts src/features/folders`
Expected: FAIL because search/folder completion is absent.

- [ ] **Step 3: Implement client-side owner-local search and safe folder deletion**

Normalize title/content text locally, rank title exact/prefix/substrings before content, and never issue a global Firestore content query. Require move-to-Uncategorized or cancellation for a non-empty folder, then logically archive it; physical folder deletion remains denied to browser clients.

- [ ] **Step 4: Verify**

Run: `npm test -- src/features/mindmaps/search.test.ts src/features/folders && npm run test:rules`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/mindmaps src/features/folders
git commit -m "feat: organize and search private mind maps"
```

**Acceptance criteria:** Search finds title/content only from authorized owner data; folder archival cannot silently destroy maps or create an unusable folder reference.

### Task 9: Implement immutable revision history and restore

**Dependencies:** Tasks 4 and 6.

**Files:**
- Create: `src/features/history/VersionHistoryPanel.tsx`, `RestoreRevisionDialog.tsx`
- Modify: `src/features/history/revisionRepository.ts`, `src/features/editor/useSaveQueue.ts`, `firestore.rules`
- Test: revision repository/panel/dialog/Rules tests

**Interfaces:**
- `createRevisionAndSaveMap(input): Promise<SaveResult>`
- `listRevisions(mapId): Promise<Revision[]>`
- `restoreRevision(map, revision): Promise<void>`

- [ ] **Step 1: Write failing revision tests**

```ts
it('creates no more than one autosave revision in 30 seconds', async () => {});
it('commits map update and new snapshot atomically before pruning revision 51', async () => {});
it('keeps all revisions and sets revisionPrunePending when prune fails', async () => {});
it('writes restore-protection before replacing the current map', async () => {});
it('rejects every revision update through Rules', async () => {});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/features/history && npm run test:rules -- src/test/rules/revisions.rules.test.ts`
Expected: FAIL because history flow is absent.

- [ ] **Step 3: Implement bounded immutable history**

Commit current-map update plus new snapshot atomically first. After success, prune one oldest excess revision. If pruning fails, preserve all snapshots, set `revisionPrunePending`, surface retry, and suppress further automatic snapshots until cleanup succeeds; current-map saves still proceed. Restore writes `restore-protection` plus the restored current state atomically; never mutate a historic revision.

- [ ] **Step 4: Verify**

Run: `npm test -- src/features/history && npm run test:rules -- src/test/rules/revisions.rules.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/history src/features/editor firestore.rules src/test/rules
git commit -m "feat: add protected map revision history"
```

**Acceptance criteria:** Revision history is immutable, owner-only, and restoration remains recoverable. Map/new-snapshot writes are atomic; prune failure cannot lose an old snapshot and is visible as pending cleanup, with temporary 51-revision retention allowed.

### Task 10: Implement Markdown import and export

**Dependencies:** Tasks 5 and 7.

**Files:**
- Create: `src/features/editor/importMarkdown.ts`, `exportMarkdown.ts`, `ImportDialog.tsx`
- Test: import/export tests

**Interfaces:**
- `parseMarkdownFile(file: File): Promise<{ title: string; markdown: string }>`
- `downloadMarkdown(filename: string, markdown: string): void`

- [ ] **Step 1: Write failing file-flow tests**

```ts
it('accepts UTF-8 .md input within the byte limit and proposes a new map', async () => {});
it('rejects invalid extension/decode/size without a Firestore write', async () => {});
it('exports the exact current Markdown with a sanitized filename', () => {});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/features/editor/importMarkdown.test.ts src/features/editor/exportMarkdown.test.ts`
Expected: FAIL because utilities/dialog are absent.

- [ ] **Step 3: Implement local-only import/export**

Validate extension, UTF-8 decoding, byte cap, and title derivation before a confirmation. Always create a new map; never overwrite on import. Export exact editor text through browser download only.

- [ ] **Step 4: Verify**

Run: `npm test -- src/features/editor/importMarkdown.test.ts src/features/editor/exportMarkdown.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/editor
git commit -m "feat: add Markdown import and export"
```

**Acceptance criteria:** File transfer is local/browser-only, validates data before write, and cannot overwrite a map silently.

## Phase 3 — Release Readiness

### Task 11: Establish integration and browser E2E coverage

**Dependencies:** Tasks 2–10.

**Files:**
- Create: `src/app/Workspace.integration.test.tsx`, `playwright.config.ts`, `e2e/*`
- Modify: `package.json`, `README.md`

**Interfaces:**
- Scripts: `test`, `test:rules`, `test:e2e`, `lint`, `typecheck`, `build`, `test:all`.

- [ ] **Step 1: Write cross-feature and browser flows**

```tsx
it('allows an approved UID to create, edit, save, search, version, restore, export, and reopen a private map', async () => {});
it('shows conflict resolution after competing device writes', async () => {});
```

E2E scenarios: 1280 desktop, 360 mobile, Google popup test-project flow, unauthorized direct route, Markmap native interactions, two-context conflict, and public-bundle secret/content scan.

- [ ] **Step 2: Run tests to verify coverage gaps**

Run: `npm test -- src/app/Workspace.integration.test.tsx && npm run test:e2e`
Expected: FAIL until flows exist and local E2E configuration is complete.

- [ ] **Step 3: Implement test fixtures and harness**

Use synthetic Markdown only. Route Firebase SDK to Emulator for E2E where supported. Keep real Google popup validation as manual QA against an approved non-production Firebase project; do not encode real credentials in tests.

- [ ] **Step 4: Verify all quality gates**

Run: `npm run lint && npm run typecheck && npm run test:all && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src e2e playwright.config.ts package.json package-lock.json README.md
git commit -m "test: cover private map workflows"
```

**Acceptance criteria:** Unit, component, integration, Rules, browser E2E, responsive, conflict, and unauthorized-access evidence exists.

### Task 12: Complete API-key review and App Check assessment without enforcement

**Dependencies:** Tasks 2–4; Firebase project operator access; no production deployment approval.

**Files:**
- Create: `docs/security/firebase-api-key-review.md`, `docs/security/firebase-app-check-assessment.md`
- Test: documented read-only review checklist

**Interfaces:**
- API review records key label/identifier, environment, allowed Firebase APIs, excluded non-Firebase APIs, reviewer/date; never stores a secret key value.
- App Check assessment records provider candidate, debug/dev strategy, UX impact, metrics, rollout/rollback recommendation, and explicit enforcement status `not-enabled`.

- [ ] **Step 1: Create review templates**

Include checks for public Firebase API-key restrictions, no unrelated API allowlist, no service-account/AWS/internal content in repository/build, and production approval gates.

- [ ] **Step 2: Execute read-only project review**

Run: authorized operator reviews Firebase/Google Cloud Console configuration.
Expected: completed records or explicit blockers; no API-key restriction, App Check enforcement, or production Rules change occurs.

- [ ] **Step 3: Commit review records**

```bash
git add docs/security
git commit -m "docs: record Firebase security readiness"
```

**Acceptance criteria:** API key and App Check decisions are evidenced; App Check is not mistaken for Auth/Rules and is not enforced without approval.

### Task 13: Create CI, GitHub Pages workflow, and rollback runbook

**Dependencies:** Tasks 1–12; separate authorization to add workflow files. Production deployment still requires a later approval.

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/deploy-pages.yml`
- Modify: `README.md`, `.gitignore`

**Interfaces:**
- CI runs `npm ci`, typecheck, lint, unit/integration/Rules tests, E2E smoke, and build.
- Initial Pages workflow runs only by `workflow_dispatch`, builds/uploads `dist/`, and targets protected `github-pages` environment; adding an automatic `main` deployment trigger is a separate future approved change.

- [ ] **Step 1: Write workflow contract checklist**

```text
- Vite build resolves assets under /markmap-aws/.
- CI must fail before deploy on test/type/build failure.
- Pages workflow has contents: read, pages: write, id-token: write only.
- Concurrency prevents stale queued deploys.
- workflow_dispatch accepts an approved rollback commit/ref.
- No Firebase production Rules/App Check command appears in Pages workflow.
```

- [ ] **Step 2: Implement non-production deployment-ready workflows**

Configure Pages source as GitHub Actions. Create a `workflow_dispatch`-only workflow with protected `github-pages` environment and artifact upload. Keep `actions/deploy-pages` disabled behind an explicit environment/approval condition or omit its invocation until separate production release authorization. Document rollback as a future approved redeploy of last known-good commit/artifact; do not execute it under this plan.

- [ ] **Step 3: Verify workflow/artifact contract**

Run: `npm run build && git diff --check`
Expected: PASS; `dist/` is the only uploaded Pages artifact and no workflow contains credentials/internal content.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows README.md .gitignore
git commit -m "ci: prepare guarded GitHub Pages release"
```

**Acceptance criteria:** GitHub Actions can build/test/upload the static site and has a documented no-Blaze rollback path without auto-deploying production.

## Deferred Release Execution (outside this plan)

Production Firestore Rules deployment, invoking `actions/deploy-pages`, App Check enforcement, production smoke testing, and rollback execution are deliberately outside this approved implementation plan. They require a distinct release authorization that identifies the exact commit/artifact, Rules version, environment approval, test UID, operator, and rollback target.

## Plan Self-Review

### Requirement coverage

- All mandatory functions have at least one delivery task and one test class in the traceability table.
- Security tasks precede Firestore-backed user workflow tasks.
- Search is client-side over owner-authorized data, preserving Spark/no-external-search constraints.
- Versioning, import/export, responsive UI, Actions deployment, API-key review, App Check assessment, and rollback remain in scope; they are phased, not omitted.

### Consistency checks

- UID allow-list is `authorizedUsers/{uid}` in Spec, Rules, tests, and Task 3.
- Map ownership is immutable `ownerUid` in schema, Rules, repositories, and all direct-SDK test cases.
- Markmap interaction stays package-owned in the Spec and Task 5.
- Production changes remain gated in every phase.

### Approval gate

Do not start Task 1 until the user approves the final Spec/Plan and supplies the Source bootstrap gate in Specification Section 14. Do not perform any action in “Deferred Release Execution” without a separate production release authorization.