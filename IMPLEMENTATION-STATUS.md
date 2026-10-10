# Connector Tracker implementation status

Baseline reviewed: approved `main` at `24a7e834dba793a70c7a051deb122336536fb1f1` (v0.9.0). The parked `ux-next-action-experiment` branch remains separate and was not merged. The existing local demo includes the named 20K conversion, V07 Lead/appointment/follow-up refinements, Event Day reporting, Connector branding and test commission rules described in the master brief.

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
| 1 · minimum cloud and shared login | **Partial** | Apps Script API, browser client, sign-in gate, private Sheet schema, setup guide and cloud smoke-record flow added. Sheet created with empty headers. Still requires manual Apps Script project/property/deployment setup, verified ConnectorAccess rows, endpoint configuration, and actual two-device checks. |
| 2 · workflow cloud wiring | **Not started** | Existing demo workflows remain local-only; the authenticated view intentionally exposes only the Phase 1 smoke record. |
| 3 · reliability/local-first | **Not started** | No CRM outbox sync, conflict handling, reassignment audit, or migration/recovery for CRM records. |
| 4 · Connector admin/reporting | **Not started** | No cloud CRUD for branding, contact fields, profile photo cache, production reports or message actions. |
| 5 · production hardening | **Not started** | Dedicated origin, security review, backup/restore, full regression, and revocation/device testing remain. |
| 6 · weekly email | **Deferred** | Only after data and core CRM are reliable; not implemented. |

## Phase 1 evidence ledger

- **Implemented in repository:** Companion-backed server-side credential verification; scoped temporary sessions; active Partner and Connector access rechecks; sessionStorage-only session token; authenticated cloud test-record create/read/update; visible separation from local demo; version/About/cache updates.
- **Created in Google Drive:** private `Connector Tracker Cloud Store - Setup Pending`, ID `1Mj7WuFkDXkfFtPHd5Y2LuKLer5L1-nC61kdLTodb9rs`, with four Phase 1 tabs and empty headers.
- **Not deployed:** standalone Apps Script project and Web App deployment.
- **Not verified:** API round-trip, wrong-password rejection, Partner/Connector isolation, revocation, persistence after restart, second-device sync, or offline acknowledgement behaviour. Follow `cloud/SETUP.md` after deployment.
- **Protected systems:** Appointment Companion deployment/auth model was not changed. Its public source was inspected; the current Companion frontend uses `partner_id` plus `workspace_key`. The open Companion Apps Script's latest execution log shows a password audit of 5 accounts with 0 readable passwords and 5 hash-only accounts. The currently deployed handler source was not independently verified, so setup explicitly requires confirming the `getPartnerProfile` and `getPublicPartnerProfile` actions before connecting it. Tracker does not replicate the key.
