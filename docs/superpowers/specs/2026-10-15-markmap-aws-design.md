# Markmap AWS — Product, Architecture, UI/UX, Data, and Security Specification

Status: Final revision draft for approval. No product code, Firebase production configuration, Firestore Rules deployment, App Check enforcement, GitHub Pages deployment, or data migration is authorized by this document.
Date: 2026-10-15

## 1. Purpose and Fixed Constraints

Markmap AWS is a private knowledge workspace for AWS Partner program knowledge. Users author Markdown and view it as an interactive mind map. The public GitHub repository and public GitHub Pages host must never contain AWS Partner internal documents, exported user maps, service-account keys, AWS credentials, or other secrets.

Fixed architecture:

- Repository: `https://github.com/tuha1994/markmap-aws`.
- Public site target: `https://tuha1994.github.io/markmap-aws/`.
- React + Vite + TypeScript.
- Official npm packages `markmap-lib` and `markmap-view`; never clone, fork, vendor, or copy Markmap source.
- Firebase Authentication, Google Sign-in, and Cloud Firestore.
- GitHub Pages published through GitHub Actions.
- Firebase Spark-compatible design: no dedicated backend, Cloud Functions, Cloud Run, Firebase Storage, external search service, or paid-only Firebase dependency.
- Vite production base is exactly `/markmap-aws/`.
- Firestore Rules default to deny; only explicitly allow-listed Firebase UIDs can access application data.
- Production Rules changes, production App Check enforcement, and production deployment each require separate approval.

Markmap’s programmatic model transforms Markdown into structured data with `markmap-lib` and renders the result as an interactive SVG with `markmap-view`.[1] The Markmap repository is reference-only; no source from it is copied into this project.[10]

## 2. Repository Survey and Gap Analysis

### 2.1 Survey evidence

Observed on 2026-10-15:

- The repository worktree began with Git metadata only; no application source, manifest, test suite, README, historic application commit, or remote branch head was present.
- The public repository reported as empty and the supplied Pages URL reported “Site not found”.
- The actual documentation paths were verified:
  - `docs/superpowers/specs/2026-10-15-markmap-aws-design.md`
  - `docs/superpowers/plans/2026-10-15-markmap-aws-implementation-plan.md`

This is a greenfield application. There is no existing source to overwrite or refactor.

### 2.2 Gap analysis before revision

| Requirement group | Previous state | Gap classification | Revision outcome |
| --- | --- | --- | --- |
| Google sign-in | Deferred as an open choice | Missing | Google provider, popup-first flow, authorized-domain and error behavior are specified. |
| UID allow-list | Baseline existed | Incomplete | Exact `authorizedUsers/{uid}` authority, privileged first grant, Rules predicate, and test matrix are specified. |
| Multiple maps and CRUD | Explicitly excluded | Missing | Map lifecycle, ownership, delete semantics, and acceptance criteria are specified. |
| Editor and Markmap preview | Package boundary existed | Incomplete | Lifecycle, assets, debounce, cleanup, native interaction, and error behavior are specified. |
| Firestore schema | Deferred | Missing | Folders, maps, revisions, metadata/indexes, constraints, and immutable fields are specified. |
| Cross-device synchronization | Deferred | Missing | Serialized save generations, remote conflict flow, offline/retry, and durable-state rules are specified. |
| Search, folders, history, import/export | Explicitly excluded | Missing | Scope, user flow, schema support, tests, and phases are specified. |
| Responsive UI | Deferred | Missing | Desktop/mobile screen model and target acceptance widths are specified. |
| GitHub Pages Actions | Explicitly excluded | Missing | `/markmap-aws/` base, workflow behavior, rollout and rollback are specified. |
| Rules test/App Check/security | Strong baseline existed | Incomplete | Direct SDK emulator matrix, API-key review, App Check assessment, and production approval gates are specified. |
| Spark limits/revision retention | Deferred | Missing | Byte limit, revision retention/cadence, cleanup strategy, and monitoring are specified. |

### 2.3 Gap analysis after revision

All confirmed functional and fixed-architecture requirements now map to a specification section, implementation phase, test class, and acceptance criterion in this document and the plan. Remaining blockers are approval gates and configuration/operator details listed in Section 14; none is a missing product or architecture decision.

## 3. Personas, Permission Model, and First UID Grant

### 3.1 Personas

- Approved user: signed in with Google and represented by an enabled `authorizedUsers/{uid}` document. Can access only their own folders, maps, and revisions.
- Unauthorized user: unauthenticated, signed in but absent from the allow-list, or signed in with `enabled: false`. Cannot read or write any application data.
- Privileged project operator: an individual with authorized Firebase Console/Google Cloud project access. This is not an in-app application role. They create, disable, or remove allow-list records only through an approved privileged process.

There is no in-app administrator, user invitation interface, public sharing, anonymous access, or cross-user collaboration in this release.

### 3.2 First UID grant procedure

1. The intended user signs in successfully with Google once in the approved Firebase project, creating/identifying their Firebase Authentication UID.
2. The privileged project operator obtains that UID from Firebase Authentication; it must never be inferred from an email address.
3. The operator creates `authorizedUsers/{uid}` from Firebase Console using the approved document shape in Section 8.1.
4. The operator validates the record in a non-production environment first where available, then performs the production creation only after the security/deployment approval gate.
5. The user refreshes/re-authenticates. Rules allow access only when the record is present and `enabled: true`.

Browser clients cannot self-provision, list, or mutate allow-list records. This deliberately requires a privileged operator because a static public site has no trusted application server.

## 4. User Experience Specification

### 4.1 Screens

1. Authentication gate
   - Brand-neutral landing state with “Continue with Google”.
   - Loading state while Firebase Authentication resolves session state.
   - Sign-in error state with retry and a safe message; never show tokens or raw provider diagnostics.
   - Use `signInWithPopup` as the primary desktop and GitHub Pages flow. Firebase documents support both popup and redirect; redirect is generally preferred on mobile, so redirect fallback is a browser/device QA criterion before enabling it.[7]

2. Authorization gate
   - Shows while the app reads the current user’s allow-list record.
   - Unauthorized state explains that the signed-in account has not been granted access and offers sign-out/retry.
   - It does not disclose authorized UIDs, map names, folder names, or whether another account has access.

3. Workspace: desktop
   - Header: current map title, save/sync state, actions for import/export/history, and account/sign-out menu.
   - Left sidebar: create map, search, folder tree, maps list.
   - Center pane: Markdown editor.
   - Right pane: Markmap SVG preview and a minimal Markmap command toolbar.

4. Workspace: mobile
   - Header remains visible with save/sync state and primary actions.
   - One primary pane at a time using accessible tabs: Maps, Edit, Preview.
   - Search, folders, map selection, history, import/export remain reachable without horizontal scrolling.

5. Dialogs/panels
   - Create/rename/delete map.
   - Create/rename/delete folder.
   - Folder deletion destination chooser.
   - Version-history list, preview, restore confirmation.
   - Markdown import review/confirmation.
   - Conflict resolution: Keep mine / Use remote.

### 4.2 Main flows

#### Sign-in and access

1. User opens the Pages site.
2. App resolves Auth state.
3. Signed-out user invokes Google popup sign-in.
4. App reads only `authorizedUsers/{request.auth.uid}`.
5. An enabled record opens the private workspace; absent/disabled record opens unauthorized state and subscribes to no workspace data.

#### Create, edit, preview, and save

1. User creates a map with a title and optional folder.
2. App creates the current map document with immutable `ownerUid` equal to the signed-in UID.
3. Editing updates local draft immediately.
4. Preview transforms the local Markdown after a 300 ms render debounce.
5. Save starts after 1.5 seconds idle, or on explicit save/version action.
6. Header state changes only after the matching Firestore write resolves.

#### Search and organize

- Search is client-side across already authorized, owner-scoped map documents: title first, then normalized current Markdown text.
- Folders are owner-scoped. Deleting a non-empty folder requires the user to choose “Move maps to Uncategorized” or cancel; it never deletes maps implicitly.

#### Version and restore

- History lists immutable snapshots newest first.
- Previewing a revision is non-destructive.
- Restore requires confirmation, creates a `restore-protection` snapshot first, then replaces current map content from the selected revision.

#### Import/export

- Import accepts one UTF-8 `.md` or `.markdown` file, validates it locally, shows a title/content review, and creates a new map. It never overwrites an existing map.
- Export downloads the exact current Markdown as a sanitized `<title>.md` file. It does not upload data to another service.

### 4.3 State and feedback requirements

| State | User-visible behavior | Data safety behavior |
| --- | --- | --- |
| Loading auth/access | Clearly labeled loading region | No workspace subscriptions until enabled allow-list result. |
| Saved | “Saved” with latest durable revision/timestamp | Only shown after latest draft generation resolves. |
| Saving | “Saving…” | Editor remains usable; writes serialize per map. |
| Unsaved | “Unsaved changes” | Browser unload/navigation warning is registered. |
| Offline pending | “Offline — changes pending” | Keep current session draft, retry when connectivity returns. |
| Save error | “Save failed — Retry” | Do not discard draft; preserve error classification without document content. |
| Conflict | “Remote change detected” with two explicit choices | Retain both local and remote values until choice. |
| Markmap render error | Preview error panel | Preserve raw Markdown and last valid SVG. |
| Unauthorized | Access-denied screen | Stop subscriptions and clear private in-memory state. |

### 4.4 Responsive and accessibility acceptance targets

- Desktop: 1280 px wide view supports sidebar, editor, and preview at once.
- Mobile: 360 px wide view has no horizontal page scroll and exposes all critical actions through tabs/menus.
- Semantic buttons, labels, focus-visible states, keyboard dialogs, non-color-only status, and accessible tab semantics are required.

## 5. Markmap Integration Design

### 5.1 Package-only boundary

Dependencies are `markmap-lib` and `markmap-view` from npm. The app may add package-provided styles/assets returned by the transformer, but it must not copy implementation code, custom-render the mind-map graph, or write a replacement zoom/pan/collapse engine.

### 5.2 Lifecycle contract

1. `MarkmapPreview` owns one SVG host ref.
2. A Markmap adapter constructs one transformer and one `markmap-view` instance per mounted preview host.
3. Each debounced Markdown update first passes through the Markdown render-security policy, then transforms the safe Markdown with `markmap-lib`, applies any transformer-reported allow-listed assets using a dedicated asset loader, then updates the existing view/root where the package API supports it.
4. The adapter does not recreate the SVG/view on every keystroke unless an official-package constraint requires it.
5. The adapter cancels timers and destroys/disposes its view on unmount, map switch, and sign-out.
6. Preview controls delegate fit/reset/zoom commands to the official view API. Native wheel zoom, drag pan, and node expand/collapse remain Markmap behavior.
7. If transform/asset loading fails, retain the last valid SVG and show an error separate from the source editor.

The official Markmap overview describes `markmap-lib` preprocessing and `markmap-view` interactive SVG rendering.[1]

### 5.3 Asset policy

- Track required styles/scripts/features returned by the Markmap transformation result rather than hardcoding undocumented external asset URLs.
- Deduplicate loaded assets by stable URL/key and clean up only assets owned by the current preview lifecycle where safe.
- Do not accept arbitrary remote asset URLs from user Markdown.
- Markdown render-security policy: raw HTML is escaped or rendered as literal text; `javascript:`, `data:`, `file:`, `blob:`, and other non-HTTP(S) link schemes are removed; external images are replaced with their alt text and are never fetched; and no user content is inserted with `innerHTML`.
- The asset loader may load only package-generated, reviewed static asset descriptors. It never derives a `<script>`, stylesheet, image, fetch, or navigation URL from user Markdown.
- Tests cover raw HTML, script/event-handler payloads, unsafe URL schemes, external-image syntax, malicious SVG/HTML-like payloads, and attempted arbitrary asset descriptors. Browser E2E/manual QA verifies real rendering and interactions.

## 6. Synchronization, Save, Conflict, and Revision Policy

### 6.1 Current document synchronization

- Maps are subscribed with owner-constrained Firestore queries; open-map updates use a document snapshot listener.
- Each local editor change increments an in-memory `draftGeneration`.
- Save queue serializes writes per map. A completed write marks the editor saved only if it corresponds to the latest confirmed generation.
- Current map documents hold monotonically increasing `contentVersion` and `updatedAt`. The client writes the expected last-seen version in a Firestore transaction; if version differs, it reports a conflict rather than blindly overwriting.
- A remote update for an unopened map updates only list metadata.
- A remote update for an open clean map replaces local displayed content.
- A remote update for an open dirty map enters conflict state. “Use remote” discards the local draft only after explicit confirmation. “Keep mine” retries as a new transaction using the remote version after explicit confirmation.

### 6.2 Offline and failed writes

- Do not enable unbounded persistent offline storage in the first release.
- Keep unsaved text only in the current in-memory browser session and show `offline-pending` or `save-error` state.
- Retry is explicit after a terminal error and automatic after an offline connectivity recovery signal.
- Before unload, warn only when the current draft differs from the latest confirmed durable content.
- This is not crash-safe draft preservation: refresh, closing the tab, browser termination, browser crash, private-mode data eviction, or a device failure can lose an unsaved in-memory draft. The warning reduces accidental loss but does not guarantee recovery. The UI must say this plainly when offline-pending/unsaved state exists.

### 6.3 Size and revision limits

- Markdown maximum: 256 KiB UTF-8 bytes per current map or revision snapshot.
- Title maximum: 120 Unicode code points after trim; folder name maximum: 80.
- Retain at most 50 revisions per map.
- Create a revision on explicit “Save version”, before restore, and at most once per 30 seconds of changed autosave content.
- Revisions contain complete snapshots and are immutable after creation.

Firestore documents have a 1 MiB maximum size; Spark free quota includes 1 GiB stored data, 50,000 document reads/day, 20,000 writes/day, and 20,000 deletes/day. The 256 KiB limit and bounded revision policy reserve room for document metadata/indexes and reduce quota pressure.[11]

### 6.4 Destructive operations

- Map delete is a logical delete: an owner sets immutable audit fields `deletedAt` and `deletedByUid`, and active-list queries exclude deleted maps. Browser clients may not physically delete map roots. This preserves the parent record required to authorize/read its revision subcollection and prevents direct-SDK orphan revisions. Permanent purge is out of scope and requires a separate privileged maintenance design.
- Current-map update and new revision creation are one atomic Firestore transaction/batch. After that successful commit, prune the single oldest excess revision in a separate verified operation. If pruning fails, keep every existing/new revision, flag `revisionPrunePending`, and suppress further automatic snapshot creation until pruning succeeds; ordinary current-map saves continue. This may temporarily retain 51 revisions but never loses an older revision merely because a new snapshot operation failed.
- Folder delete is a logical archive: an owner sets `archivedAt` and `archivedByUid`; browser clients may not physically delete folders. The UI moves maps to Uncategorized in bounded batches where possible. If an archived folder reference remains after a direct SDK archive, the map is safely rendered as Uncategorized rather than becoming inaccessible. New/updated maps cannot reference an archived folder.

## 7. Firestore Schema and Index Design

All timestamps are Firestore server timestamps when persisted. All client writes validate byte size/types for usability, but Rules are the authorization authority.

### 7.1 `authorizedUsers/{uid}`

```
{
  enabled: boolean,
  grantedAt: Timestamp,
  grantedBy: string
}
```

- Document ID is the literal Firebase Auth UID.
- Browser clients can read only their own record to determine access; clients cannot list or mutate this collection.
- The record has no role and grants no cross-user data access by itself.

### 7.2 `folders/{folderId}`

```
{
  ownerUid: string,
  name: string,
  normalizedName: string,
  color: string | null,
  sortOrder: number,
  archivedAt: Timestamp | null,
  archivedByUid: string | null,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

- Active folder queries exclude `archivedAt != null`.
- Archiving is irreversible to browser clients in this release; a mistaken archive is handled by moving maps and creating a new folder, not by an undocumented restore path.

### 7.3 `mindMaps/{mapId}`

```
{
  ownerUid: string,
  folderId: string | null,
  title: string,
  titleLower: string,
  markdown: string,
  contentSearchText: string,
  contentVersion: number,
  currentRevisionId: string | null,
  currentRevisionAt: Timestamp | null,
  revisionPrunePending: boolean,
  deletedAt: Timestamp | null,
  deletedByUid: string | null,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

- Client validation and Rules both cap `markdown` and `contentSearchText` at exactly 256 KiB UTF-8 bytes: `value.toUtf8().size() <= 262144` in Rules and equivalent `TextEncoder` byte counting in the client. Boundary tests cover ASCII and multi-byte Unicode values immediately below, equal to, and above the limit.[12]
- `contentSearchText` is used only after the owner-scoped map list has loaded. It is not an external/global full-text search implementation.
- `folderId` is null for Uncategorized. A non-null value must reference an existing, non-archived folder with the same owner UID.
- Single-field indexing is disabled for `markdown` and `contentSearchText` because neither is queried server-side.

### 7.4 `mindMaps/{mapId}/revisions/{revisionId}`

```
{
  ownerUid: string,
  mapId: string,
  sourceContentVersion: number,
  title: string,
  folderId: string | null,
  markdown: string,
  reason: "autosave" | "manual" | "restore-protection",
  createdAt: Timestamp,
  createdByUid: string
}
```

- Revision documents are create-only to browser clients; no update is allowed.
- Map root and revision `ownerUid`/`mapId` are immutable.

### 7.5 Required indexes

- `mindMaps`: `ownerUid ASC, deletedAt ASC, updatedAt DESC` for active list/sidebar subscriptions.
- `folders`: `ownerUid ASC, archivedAt ASC, sortOrder ASC` for active folder navigation.
- Revisions use the single-field `createdAt DESC` index in their per-map subcollection; no composite index is planned.
- Composite indexes and single-field index exemptions are added to `firestore.indexes.json`, never console-only. A query-to-index contract test parses the checked-in index file and verifies every implemented multi-field query has a matching descriptor; Emulator-only success is not accepted as index evidence.
- Additional indexes are allowed only after a selected owner-constrained query demonstrably requires them and the file/test mapping is updated.

## 8. Firestore Security Model and Rules Blueprint

### 8.1 Default-deny and allow-list predicate

Rules default-deny every unmatched path. A protected operation requires:

1. `request.auth != null`;
2. `authorizedUsers/{request.auth.uid}` exists with `enabled == true`; and
3. the document’s ownership/relationship predicate for that specific collection.

```
function accessPath(uid) {
  return /databases/$(database)/documents/authorizedUsers/$(uid);
}

function approvedUid() {
  return request.auth != null
    && exists(accessPath(request.auth.uid))
    && get(accessPath(request.auth.uid)).data.enabled == true;
}

function ownsExisting() {
  return approvedUid() && resource.data.ownerUid == request.auth.uid;
}

function ownsCreate() {
  return approvedUid() && request.resource.data.ownerUid == request.auth.uid;
}
```

Firestore Rules conditions can use `request.auth`, validate `request.resource`, and consult another document through `exists()`/`get()`; Rules document-access limits are 10 for a single/query request and 20 for a multi-document request/batch, while the per-operation limit remains applicable.[5][11]

### 8.2 Collection policy

| Path | Read/list | Create | Update | Delete |
| --- | --- | --- | --- | --- |
| `authorizedUsers/{uid}` | Only same approved UID may get its own record; list denied | Denied to browser | Denied to browser | Denied to browser |
| `folders/{folderId}` | active existing owner; get/list require `archivedAt == null`, and active queries constrain `ownerUid == request.auth.uid` and `archivedAt == null` | `ownsCreate()` + key/type validation | active existing owner + immutable `ownerUid` + validated fields/archival transition | Denied to browser |
| `mindMaps/{mapId}` | active existing owner; get/list require `deletedAt == null`, and list queries constrain `ownerUid == request.auth.uid` and `deletedAt == null` | `ownsCreate()` + map validation + same-owner active-folder validation | active existing owner + immutable `ownerUid` + map validation + transaction version rule + logical-delete transition | Denied to browser |
| `mindMaps/{mapId}/revisions/{revisionId}` | approved UID owning active parent map | active parent owner + immutable snapshot validation | Always denied | active parent owner for bounded retention cleanup |

Rules are not filters. The client’s list query must include `where('ownerUid', '==', request.auth.uid)`; a query that could return another owner’s document is rejected rather than filtered.[5]

### 8.3 Validators

Final Rules must use named functions that enforce:

- whitelisted keys only;
- correct field types;
- title/folder lengths and Markdown byte-equivalent client cap enforced conservatively in Rules using string size limits;
- exact Rules string boundary tests: 65,536 characters accepted and 65,537 rejected for `markdown`/`contentSearchText`; client tests additionally enforce 256 KiB UTF-8 bytes for ASCII and multi-byte input;
- `ownerUid`, `mapId`, revision identity, and revision `createdByUid` immutable where applicable;
- allowed revision reason enum;
- map `folderId == null` or a referenced non-archived folder owned by the same requester;
- update writes preserve `ownerUid` and increment `contentVersion` exactly by one for content-affecting updates;
- browser map/folder physical deletes are always denied; logical deletion/archival fields transition only from null to a caller-owned timestamp/UID pair; archived/deleted objects and revisions below deleted maps are no longer readable through browser Rules;
- no browser write creates an `authorizedUsers` record.

## 9. Security Testing and Abuse Controls

### 9.1 Firestore Emulator Rules matrix

Rules tests use `@firebase/rules-unit-testing` and the Firestore Emulator. They make direct client-SDK-style operations through `unauthenticatedContext()` and `authenticatedContext(uid)`; server Admin SDKs are not security-test evidence because privileged server libraries bypass Rules.[6]

| Case | Expected |
| --- | --- |
| No authentication reads/writes folders/maps/revisions | Denied |
| Google-authenticated UID absent from `authorizedUsers` | Denied |
| UID with `enabled: false` | Denied |
| Enabled UID reads/list/writes another owner’s documents directly by ID or query | Denied |
| Enabled UID changes `ownerUid`, references another/archived folder, violates string-size/version rules, physically deletes a map/folder, reads an archived/deleted object, or changes immutable revision fields | Denied |
| Enabled UID lists/creates/updates/deletes `authorizedUsers` | Denied |
| Enabled owner performs valid owner-constrained list/create/update/delete | Allowed |
| Enabled owner creates valid revision; any revision update | Create allowed; update denied |
| Rules query missing owner constraint | Denied |

### 9.2 Client, integration, browser, and E2E coverage

- Unit: normalization, Markdown byte validation, filename sanitization, search ranking, save queue generation logic, conflict reducer, revision cadence, asset loader deduplication.
- Component/integration: auth/access gates, map CRUD dialogs, editor-preview update, save statuses, conflict dialog, history restore, import/export, mobile pane tabs.
- Rules: Emulator matrix above.
- Browser E2E: Playwright against local app plus Firebase Emulator for sign-in adapter test mode, map lifecycle, multiple tab/device conflict simulation, Markmap interactions, responsive viewport tests, unauthorized direct navigation, and public-bundle secret scan.
- Manual production-like QA: Google popup behavior on GitHub Pages and an approved test Firebase project; no production Rules changes are implied.

### 9.3 Public-web/API-key and App Check controls

Firebase web API keys are public project identifiers, not Firestore authorization secrets. Before deployment, the project operator reviews API restrictions and confirms the public web key is restricted to the Firebase-related APIs needed by the app; unrelated Google APIs use separate restricted keys.[4]

Evaluate Firebase App Check for web before deploy. Select a supported web provider, document local/debug behavior, measure request metrics without enforcement, assess user impact, and define rollback. App Check helps attest requests but does not replace Auth or Firestore Rules.[8]

## 10. GitHub Pages Deployment and Rollback Design

### 10.1 Build and deployment

- Vite config sets `base: '/markmap-aws/'`.
- CI workflow runs dependency install, type check, lint, unit/integration tests, Rules tests against Emulator, E2E smoke tests, and `vite build`.
- Pages workflow uses official `actions/checkout`, Node setup, static build, `actions/upload-pages-artifact`, and `actions/deploy-pages`.
- Repository Pages source is GitHub Actions.
- Initial workflow trigger is manual `workflow_dispatch` only and targets a protected `github-pages` environment; it builds/uploads a release artifact but does not become a routine production release without a later scope approval. A later approved release change may add a `push` trigger for `main` while retaining environment protection and concurrency.
- The workflow has least privilege: `contents: read`, `pages: write`, `id-token: write` only where needed for deployment.

GitHub Pages supports publishing through a custom GitHub Actions workflow and documents the upload-pages-artifact/deploy-pages sequence.[9]

### 10.2 Deployment approvals and rollback

- No production deployment job runs until the user separately approves deployment scope and the Firebase project configuration is supplied.
- The deployment workflow stores the immutable Pages artifact for each run.
- The documented rollback path is a new approved `workflow_dispatch` deployment of the last known-good Git commit/artifact, not a database rollback. It is not executed in this plan.
- Firestore schema changes are additive in this release; deleting/rewriting existing data requires a separate migration plan and approval.
- This process requires no Blaze-only service. Monitor Spark quotas in Firebase Console before/after release; if quota is exceeded, the app shows safe save failure rather than silently rerouting to paid services.

## 11. Phased Delivery Scope

Phase 0 — Approved foundations and security: Vite base, Firebase config boundary, Google popup sign-in, first UID grant runbook, default-deny Rules, Emulator tests.

Phase 1 — Core private mind maps: owner-scoped folders/maps, Markdown editor, official Markmap preview, save/sync statuses, conflict handling, responsive shell.

Phase 2 — Knowledge management: search, folders completion, immutable version history/restore, import/export.

Phase 3 — Release readiness: accessibility/responsive QA, GitHub Actions Pages workflow, API-key review, App Check assessment, test-project smoke evidence, and production rollout/rollback runbook. Production rollout execution is outside this plan.

No phase removes a confirmed feature. Later phases sequence complexity and release risk only.

## 12. Requirement Traceability Summary

The complete Requirement → Task → Test → Acceptance matrix is maintained in the Implementation Plan, Section 5. It covers every confirmed function and each security/deployment obligation.

## 13. Explicit Non-Goals

- Public maps, anonymous access, public search, share links, cross-user collaboration, or in-app user administration.
- Dedicated backend server, Cloud Functions, Cloud Run, Firebase Storage, external full-text search, paid-only Firebase service, or a fallback provider.
- Publishing internal AWS Partner materials or production credentials.
- Production Rules, App Check enforcement, production deployment, or rollback execution without separate approval.

## 14. Configuration and Approval Gates

| Gate | Required before | Required information or approval |
| --- | --- | --- |
| Source bootstrap | Task 1 | Approval of this Spec/Plan and authorization to create source files. |
| Firebase integration | Task 2 | Firebase project ID, Spark confirmation, Firebase web config values, Google provider enabled, and `tuha1994.github.io` authorized domain. |
| First access validation | Task 3 local test / Task 11 non-production QA | A test UID obtained after Google sign-in, plus privileged operator identity/process for `authorizedUsers/{uid}`. Do not infer UID from email. |
| Production Rules deployment | Deferred Release Execution only | Separate Rules approval, Emulator test evidence, API-key review outcome, and designated operator. |
| Pages deployment | Deferred Release Execution only | Separate approval to enable/deploy Pages workflow, production Firebase config, and clean CI evidence. |
| App Check enforcement | Deferred Release Execution only | Completed assessment, observed metrics, explicit enforcement approval, and rollback owner. |

The initial UID is not required to start Task 1. It is required before a real access-control validation or production release can be performed.

## 15. Final Review Checklist

- Every functional requirement in the final-review prompt is specified in Sections 4–11.
- Every Firestore operation has an owner/UID authorization rule and Emulator test category.
- Conflicts preserve both drafts and require an explicit user decision.
- Revision limits and deletes are bounded for Spark quotas and Rules access-call limits.
- Markmap uses package-owned interaction and lifecycle cleanup.
- Public repository and Pages exposure controls are explicit.
- No required feature is deferred out of scope.

## 16. Readiness Decision

Status: NOT READY FOR CODING — pending user approval and configuration blockers, not design gaps.

Evidence:

- The Spec includes full UI/UX, schema, security model, synchronization, tests, deployment, rollback, and all confirmed functional requirements.
- The companion plan maps every requirement to an implementation task/test/acceptance criterion.
- Credentials, actual Firebase project identity, initial allow-listed UID, privileged operator process, authorized domains, API-key review, and deployment approval cannot be guessed or performed safely from this repository.

Once the Source bootstrap and Firebase integration gates are approved, the design is READY FOR CODING. The later gates deliberately block only the relevant security validation or production action.

## Sources

[1] https://markmap.js.org/docs/markmap
[4] https://firebase.google.com/docs/projects/api-keys
[5] https://firebase.google.com/docs/firestore/security/rules-conditions
[6] https://firebase.google.com/docs/firestore/security/test-rules-emulator
[7] https://firebase.google.com/docs/auth/web/google-signin
[8] https://firebase.google.com/docs/app-check/web/recaptcha-provider
[9] https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
[10] https://github.com/markmap/markmap
[11] https://firebase.google.com/docs/firestore/quotas
[12] https://firebase.google.com/docs/reference/rules/rules.String
