# Firebase web API-key review

## Record status

- **Record created:** 2026-10-16
- **Review status:** `blocked` — no authorized Firebase/Google Cloud Console operator or project identity was supplied to this worktree.
- **Environment:** `not-recorded`
- **Reviewer/date:** `not-recorded` / `not-performed`
- **Production change status:** `none` — this record does not authorize or make any API-key restriction, Firebase Rules, App Check, deployment, or billing-plan change.

This is a read-only assessment record, not evidence that a particular Firebase project or key is configured correctly. Do not add an API-key string to this file. A Firebase web API key identifies the Firebase project/app; it does not authorize Firestore access. Firestore Rules and App Check remain separate controls.[1]

## Required operator record

An authorized operator must complete this table from **Google Cloud Console → APIs & Services → Credentials** and save no key value in the repository.

| Field | Required evidence | Current value |
| --- | --- | --- |
| Firebase project ID | Console project selector, recorded only after operator confirmation | `not-recorded` |
| Key label | Console display label, for example the Firebase-created browser key label | `not-recorded` |
| Key identifier | Console key UID/identifier; never the key string | `not-recorded` |
| Environment | Development, test, staging, or production as confirmed by the operator | `not-recorded` |
| Application restrictions | Exact restriction type and allowed web origins, if configured | `not-verified` |
| Allowed Firebase-related APIs | Exact API-restrictions allowlist copied as API names; verify only APIs required by the app are retained | `not-verified` |
| Excluded non-Firebase APIs | Explicit confirmation that unrelated APIs are absent; include `Generative Language API` if present as a failure | `not-verified` |
| Reviewer and review date | Named authorized operator and ISO-8601 date | `not-recorded` |
| Outcome | `approved`, `blocked`, or `needs-remediation`; include a non-secret evidence location | `blocked` |

Firebase directs operators to apply appropriate API restrictions to Firebase-provisioned keys, use such keys only for Firebase-related APIs, and use separate restricted keys for non-Firebase services. It specifically warns not to allowlist the Generative Language API on a publicly accessible Firebase key.[1]

## Read-only operator checklist

1. Select the confirmed project in Google Cloud Console. Do **not** click Save, Update, Restrict key, Delete, or create a key during this review.
2. Open **APIs & Services → Credentials**, locate the Firebase web key matched to the web app, and record only its label and key UID in the table above. Do not copy the API-key value into this document, issues, logs, or chat.
3. Read the key's **Application restrictions** and **API restrictions**. Record the exact Firebase-related API names currently allowed. Do not infer the list from this repository.
4. Confirm that no unrelated API is allowlisted. A non-Firebase dependency needs its own separately restricted key rather than inclusion on the public Firebase key.[1]
5. If a restriction change could be needed, stop this review. Test an approved change with a test app/test key first and obtain separate production approval before any production edit.[1]
6. Complete the repository/build guard below and record its result. A clean guard is not proof of Console restrictions; it only checks the public code/build inputs for selected credential markers.
7. Leave this record `blocked` until the operator fills the required fields. No absent value is an approval.

## Read-only repository and build guard

Run this from the repository root after `npm run build`. It reads `src/`, `public/` (when present), and the generated `dist/` tree without printing matched content. It fails if it finds common service-account, AWS credential, private-key, or explicit internal-only markers. The markers are a narrow automated guard; the reviewer must still assess project-specific internal material manually because no project-specific classification vocabulary was supplied.

```bash
npm run build
node --input-type=module <<'NODE'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['src', 'public', 'dist'].filter(existsSync);
const patterns = [
  ['service-account JSON', /["']type["']\s*:\s*["']service_account["']/i],
  ['AWS access-key ID', /\bAKIA[0-9A-Z]{16}\b/],
  ['AWS credential field', /\baws_(?:access_key_id|secret_access_key|session_token)\b/i],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['explicit internal-only marker', /\b(?:internal[- ]only|confidential[- ]internal|do not distribute externally)\b/i]
];
const files = [];
const visit = (path) => {
  for (const entry of readdirSync(path)) {
    const full = join(path, entry);
    if (statSync(full).isDirectory()) visit(full);
    else files.push(full);
  }
};
roots.forEach(visit);
const hits = files.flatMap((file) => {
  const text = readFileSync(file, 'utf8');
  return patterns.filter(([, pattern]) => pattern.test(text)).map(([name]) => `${file} (${name})`);
});
if (hits.length) {
  console.error(`FAIL: public-content guard found ${hits.length} marker(s):`);
  hits.forEach((hit) => console.error(`- ${hit}`));
  process.exit(1);
}
console.log(`PASS: public-content guard scanned ${files.length} file(s) across ${roots.join(', ')}.`);
NODE
```

## Decision and approval gate

- **Current decision:** `blocked`; no key label, UID, project/environment mapping, or Console allowlist was available for review.
- **Future action (requires separate approval):** an authorized operator may test an evidence-backed restriction change outside production, then seek an explicit production API-key change approval.
- **Explicitly not approved:** API-key edits, new keys, key deletion/rotation, App Check enforcement, Firebase Rules changes, deployment, use of non-Firebase APIs on the Firebase key, or a paid-plan upgrade.

## Sources

[1] https://firebase.google.com/docs/projects/api-keys
