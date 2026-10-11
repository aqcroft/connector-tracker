# Connector Activity Tracker (CAT) implementation status

Baseline reviewed: approved `main` at `24a7e834dba793a70c7a051deb122336536fb1f1` (v0.9.0). The parked `ux-next-action-experiment` branch remains separate and was not merged. The existing local demo includes the named 20K conversion, V07 Lead/appointment/follow-up refinements, Event Day reporting, Connector branding and test commission rules described in the master brief. The product is Connector Activity Tracker (CAT); Leicester Dynamite is only the first pilot, with Miss England and other independent Connectors intended to use the same PWA.

## Existing feature audit

| Status | Features |
|---|---|
| **Already working locally** | Standalone PWA shell and install manifest; mobile Event Day flow; named 20K creation/conversion to Lead; direct Lead creation; appointment and separate customer/Partner outcomes; follow-ups and Action Inbox; Connector selection/branding; funnel/leakage reports; commission snapshots. These are browser-local demo workflows, not cloud-backed operations. |
| **Partly working / local-only** | IndexedDB with localStorage fallback; local outbox/history; sample Partner switcher and role filtering; local Connector CRUD/branding; commission rules; aggregate sharing preview. There is no endpoint in the v0.9.0 app, and these controls are not server authentication or server permissions. |
| **Not implemented at baseline** | Real sign-in, shared Partner directory verification, server-enforced Connector allowlist, cloud CRM CRUD, cross-device sync, offline queue/retry/conflict handling, real shared reports, production backup/restore and verified production commission rules. |

The source has repeated definitions of several UI functions, including `render`, `shell`, `homeView`, `leadsView` and `followupsView`; the later declarations are active. Phase 1 leaves this legacy code untouched and gates it behind the local demo route rather than risking an unnecessary UI refactor.

## Milestone checklist

| Phase | Status | Evidence / remaining work |
|---|---|---|
| 0 · inspect and protect | **Partial** | Clean approved v0.9.0 baseline confirmed; experiment branch inspected by ref only; remote branch `codex/phase-1-auth-cloud` created. The working copy is an isolated managed worktree. No baseline screenshots or automated regression suite collected. |
| 1 · minimum cloud and shared login | **Partial** | Companion-backed Apps Script API and sign-in are implemented locally, plus private Sheet schema, setup guide and test-record endpoint. Sheet currently has the original four headers. Still requires running the initializer to add `ConnectorProfiles` and `CRMRecords`, entering verified Connector grants, CAT backend property setup, deployment, PWA endpoint configuration and real-device checks. |
| 2 · multi-Connector foundation and workflow cloud wiring | **Implemented locally · not live-tested** | The API now stores the existing Event, 20K, Lead, appointment/outcome/follow-up and reporting data shapes in `CRMRecords`; Connector branding is stored separately; Connector creation and Partner grants are server actions. The signed-in PWA uses the existing CRM screens with local-first queued sync and periodic cloud refresh. Server reads share Events/counts within an authorised Connector and restrict Lead/20K/customer result details to their owner and Connector Admins. These changes have only been exercised with local mocks; they are not deployed. |
| 3 · reliability/local-first | **Partial · not live-tested** | Per-Partner local state, persistent change queue, version checks, idempotent retries, offline queueing and online/focus refresh are implemented locally. Conflict recovery UI, real offline/device testing, reliable audit recovery, backup/restore and migration of any existing production data remain outstanding. |
| 4 · Connector admin/reporting | **Partial · not live-tested** | Existing Connector selection, branding and portfolio screens now read cloud-backed Connector metadata; Admins can create a Connector and grant existing Partner IDs. Live multi-Connector reports, Partner-facing aggregate totals, contact/photo administration and revocation tests remain to verify. |
| 5 · production hardening | **Not started** | Dedicated origin, security review, backup/restore, full regression, and revocation/device testing remain. |
| 6 · weekly email | **Deferred** | Only after data and core CRM are reliable; not implemented. |

## Phase 1 evidence ledger

- **Implemented in repository:** Companion-backed server-side credential verification; scoped temporary sessions; active Partner and Connector access rechecks; allowlist-before-Companion gate; persistent atomic pilot login limits; strict test-record ownership; sessionStorage-only session token; authenticated cloud test-record create/read/update; visible separation from local demo; version/About/cache updates.
- **Created in Google Drive:** the existing private Connector Tracker Cloud Store, with four Phase 1 tabs and empty headers. Its ID is intentionally kept out of public source files.
- **Not deployed:** standalone Apps Script project and Web App deployment.
- **Cloud schema extension:** `initializeTrackerCloud()` adds two new tabs without rewriting the four original tabs: `ConnectorProfiles` holds Connector code/logo/colours/contact; `CRMRecords` holds versioned, Connector-keyed entity rows and JSON payloads. The existing CloudTestRecords tab remains compatible.
- **Not verified against live services:** valid Companion password verification, CAT API sheet read/write, two-device sync, concurrent conflict handling, restore after restart, revocation on every CRM action, or live role-based privacy. The read-only Companion health/profile checks reached the published service, and local mocked security tests are available in `cloud/security-tests.cjs`.
- **Protected systems:** Appointment Companion deployment/auth model was not changed. Its public source was inspected; the current Companion frontend uses `partner_id` plus `workspace_key`. The open Companion Apps Script's latest execution log shows a password audit of 5 accounts with 0 readable passwords and 5 hash-only accounts. The currently deployed handler source was not independently verified, so setup explicitly requires confirming the `getPartnerProfile` and `getPublicPartnerProfile` actions before connecting it. Tracker does not replicate the key.

## Multi-Connector product requirements

- CAT is the product and PWA installation name. Leicester Dynamite is a pilot Connector, not the application's name or a global data scope.
- Leicester Dynamite, Miss England and future organisations are separate Connector records with independent branding, Events, 20Ks, Leads, appointments, follow-ups and reports. Existing stable record IDs and local PWA data must be retained during migration.
- Every cloud record and operation must be scoped to a Connector ID and checked against the signed-in Partner's current Connector grants on the server. A Partner must not switch into an unassigned Connector by changing a browser value or request.
- Admins may switch among the Connectors they administer and view per-Connector reports plus portfolio totals. Portfolio aggregation must include only Connectors the Admin is authorised to administer. Ordinary Partners see only assigned Connectors and their permitted records.
- Keep the PWA independent from Appointment Companion and leave PRISM unchanged. Companion is used only as the Partner identity/credential authority; CAT owns its Connector data model and cloud workflow.
- Multi-Connector cloud support is an explicit milestone before or alongside moving the existing CRM workflows. Phase 1's test-record check is a foundation, not the finished pilot or a substitute for the existing CRM.
- The smallest data shape is one `CRMRecords` tab with `record_id`, `entity`, `connector_id`, `owner_partner_id`, `payload_json`, `version`, `updated_at`, `deleted` and `last_transaction_id`. Every server request rechecks Companion status and the current Connector grant. Editor/Partner records are scoped by owner for private Lead/20K results; shared Events and aggregate Partner counts are available to assigned Connector members. Admins can see private details only in Connectors where their role is Admin.
- CAT caches a separate local state by signed-in Partner and retains the existing local demo store. Before entering real customer/Lead details, move CAT to a dedicated origin and complete the security review: a same-origin script compromise can inspect browser storage and sessionStorage.
