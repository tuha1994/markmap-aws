# Firebase App Check web assessment

## Assessment status

- **Record created:** 2026-10-16
- **Assessment status:** `blocked` — no authorized Firebase Console operator, project identity, traffic data, or production-enforcement approval was supplied to this worktree.
- **Enforcement status:** `not-enabled`
- **Repository evidence:** no App Check implementation decision is recorded here, and this assessment does not change Firebase Console state, client configuration, Rules, deployment, or billing plan.

App Check is an application-attestation control: enforcement rejects requests without valid attestation for protected backends. It complements rather than replaces Firebase Authentication and Firestore Security Rules; this project must continue to rely on its Auth and Rules design for user authorization and data access.[1]

## Candidate and evidence record

| Item | Assessment / required future evidence | Current status |
| --- | --- | --- |
| Provider candidate | `reCAPTCHA Enterprise` for a future web integration; Firebase lists it as the built-in web attestation provider and recommends it for new web integrations.[2] | `candidate-only` |
| App registration | Confirm the intended web app and domain in Firebase Console; do not record provider secrets in this repository. | `not-verified` |
| Debug/development strategy | Keep ordinary local development and CI outside enforcement. If a future approved integration requires App Check in local/CI, use the documented web debug-provider flow only in those environments; never reuse a debug token in production.[1] | `not-designed` |
| User-experience impact | Test supported browsers, accessibility, popup/cookie/privacy constraints, network latency, blocked/failed attestation, and a recovery message before enforcement. | `not-measured` |
| Metrics | Observe App Check request metrics without enforcement for a defined window. Record coverage, requests with valid/invalid/missing attestation, errors by browser/environment, and support incidents. | `not-collected` |
| Rollout recommendation | Do not enable enforcement until metrics, UX evidence, a rollback owner, and separate explicit production approval exist. | `deferred` |
| Rollback recommendation | Before enforcement, name an authorized Console operator and document the approved procedure to disable enforcement if valid users are rejected. Do not execute a rollback in this assessment. | `not-owned` |
| Spark compatibility | This assessment authorizes no paid product or plan change. Confirm the candidate provider's current eligibility and any free-tier/usage limits with the authorized operator before a future implementation. | `not-verified` |

## Read-only assessment checklist

1. In Firebase Console, select the confirmed project and open **Security → App Check**. Do **not** register an app, enable a provider, generate/use a debug token, or enable enforcement during this assessment.
2. Record whether the intended web app is already registered, the selected provider (if any), and the enforcement state for each protected product. Do not infer Console state from source code.
3. If no provider is configured, evaluate `reCAPTCHA Enterprise` as a candidate only. Record any site-key/secret handling requirements outside this repository; never commit provider secrets.
4. Define a no-enforcement observation period and the owner who will review request metrics and user-impact evidence. Firebase documentation separates monitoring request metrics from enabling enforcement.[1]
5. Define the local/CI strategy before any integration. Firebase documents a debug provider for environments that ordinary App Check validation would not classify as valid, such as local development and CI.[1]
6. Define a rollback owner and a user-visible contingency for false rejections before requesting enforcement approval.
7. Leave `Enforcement status: not-enabled` unless a separate, explicit production approval is recorded with observed metrics and rollback ownership.

## Approval boundary

This assessment does **not** authorize App Check enforcement. The following future action requires separate written approval after the evidence fields above are completed:

1. Register and configure the approved web provider in a non-production/test project.
2. Validate local/CI behavior and supported user flows without enforcement.
3. Observe request metrics and resolve coverage or UX gaps.
4. Name the rollback operator and document the reversible Console action.
5. Obtain explicit approval identifying the target project, protected products, metrics window, release owner, and rollback owner before enabling enforcement.

No Firebase Authentication setting, Firestore Security Rule, API-key restriction, deployment, production Console setting, or billing-plan change is made or approved by this document.

## Sources

[1] https://firebase.google.com/docs/app-check
[2] https://firebase.google.com/docs/app-check/web/recaptcha-provider
