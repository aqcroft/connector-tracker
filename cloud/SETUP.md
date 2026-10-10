# Connector Tracker Phase 1 Cloud Setup

This deploys the first authenticated API for Connector Tracker. The existing Appointment Companion deployment is read-only from this integration: do not change or redeploy it as part of setup.

## What exists

- Private Google Sheet: **Connector Tracker Cloud Store - Setup Pending**
- Spreadsheet ID: `1Mj7WuFkDXkfFtPHd5Y2LuKLer5L1-nC61kdLTodb9rs`
- Tabs and headers: `ConnectorAccess`, `Connectors`, `CloudTestRecords`, `AuditLog`
- Spreadsheet locale: `en_GB`; time zone: `Europe/London`
- Apps Script API source: [Code.gs](Code.gs) and [appsscript.json](appsscript.json)

The sheet has no Partner identities, access grants, Connector records, customer information or passwords. Keep it private; do not share it with Partners or publish it to the web.

## Create and configure the Apps Script project

1. In the Google account that should own the Tracker backend, create a **standalone** project at [script.google.com](https://script.google.com/).
2. Replace `Code.gs` with this folder's `Code.gs`. In Project Settings, enable **Show "appsscript.json" manifest file in editor**, then copy this folder's manifest into the project.
3. Before wiring the service, verify the currently deployed Companion API still exposes `getPartnerProfile` and `getPublicPartnerProfile`, validates the existing credentials server-side, and rejects inactive accounts. In the **open Companion Apps Script**, the recent password audit reported 5 accounts, 0 readable passwords and 5 hash-only accounts; this is a useful signal, but does not by itself prove which code is deployed.
4. In **Project Settings → Script properties**, add:
   - `TRACKER_SHEET_ID` = `1Mj7WuFkDXkfFtPHd5Y2LuKLer5L1-nC61kdLTodb9rs`
   - `COMPANION_CLOUD_URL` = the currently deployed HTTPS Web App URL in Appointment Companion's `PWA/cloud-client-v1.js`. Confirm the URL and deployment are current before using them.
5. Run `initializeTrackerCloud` from the Apps Script editor. Review the requested Sheets and external-request scopes and authorise the project as its owner. The function validates existing headers and stops on a mismatch rather than replacing them.
6. In the private spreadsheet, add only verified production rows:
   - `Connectors`: stable `connector_id`, verified display `name`, `active` set to `TRUE`.
   - `ConnectorAccess`: canonical Companion `partner_id`, matching `connector_id`, role `Admin` or `Editor`, `enabled` set to `TRUE`.
   Use the canonical Partner ID, not a display name. Start with one administrator and one verified Connector. Do not copy password/workspace-key values into this sheet.
7. Deploy as a **Web app**, executing as the project owner. The API must be reachable by the standalone PWA, including for Partners without Google accounts. The endpoint is publicly reachable, but each login and data action is checked by the code; it is not a public Sheet or anonymous write API. Review this code before deployment and do not grant users access to the underlying Sheet.
8. Copy the deployed `/exec` URL into `cloud-config.js` as `endpoint`. This URL is public configuration, not a secret. Never put a Workspace Key, session token, spreadsheet credential or admin secret in that file.
9. Publish the updated PWA from the `codex/phase-1-auth-cloud` branch only after reviewing it. The sign-in page remains explicit about missing setup while `endpoint` is blank.

## Authentication and access behaviour

- Sign-in sends the Partner ID and existing Companion password to the Tracker Apps Script over HTTPS in a POST body. The Tracker script verifies them through the Companion `getPartnerProfile` action. The key is not placed in a URL, written to the Tracker Sheet, returned to the browser after submission, or retained by Tracker code.
- On success, the Tracker API returns a random six-hour session token. The browser keeps that token in `sessionStorage` only. The backend stores the token hash and Partner ID in Script Cache; Google may evict cached sessions early, in which case the Partner signs in again.
- Every protected API request checks the session, rechecks the canonical Partner's active status through the Companion read-only `getPublicPartnerProfile` action, and re-reads Tracker Connector access. Disabling a Connector or access row takes effect on the next request. Disabling the Companion Partner profile also takes effect on the next request.
- Login failures are rate-limited per Partner ID in Script Cache. Google may evict cache entries early, so this is a best-effort guard rather than a durable account lock. Do not log or send a Workspace Key to support.
- Phase 1 cloud test records are scoped to their creating Partner and Connector, use a version check, and contain only a short test message. Do not use customer or prospect information in this check.
- Current CRM screens are isolated in **local demo mode**. A successful sign-in does not expose demo Leads or other Partner data. Full operational workflow persistence is Phase 2.

## Browser origin and deployment

Different GitHub Pages repository paths share an origin. `sessionStorage` is scoped to a tab but is not a strong security boundary against other scripts served from the same origin. Before real CRM records are enabled in Phase 2, deploy Connector Tracker on a dedicated origin (or another isolated trusted origin) and review its script/content-security controls. A different PWA icon or repository path does not create origin isolation.

The browser API uses a `text/plain` POST body to avoid a JSON preflight; requests still require a valid JSON acknowledgement. It does not use JSONP, `no-cors`, fire-and-forget writes, or browser-side Google credentials.

## Phase 1 verification checklist

Perform these checks after deployment with test accounts and test text only:

1. Correct Partner ID/password signs in; wrong password is rejected.
2. A Partner with no enabled `ConnectorAccess` row is rejected; an assigned Partner sees only assigned Connectors.
3. Create a short test message, reload/reopen the PWA, read it back, update it, and confirm the version increments. Repeat from a second device using the same Partner account.
4. A second Partner cannot read or update the first Partner's cloud test record.
5. Disable the access row and confirm the next request is rejected. Disable the Companion Partner profile and confirm the next request is rejected.
6. Disconnect the network during a test request and confirm the UI shows an error rather than a successful cloud save.
7. Confirm the Tracker Sheet contains no password/workspace-key and the browser has no localStorage credential. The session token should be present only in sessionStorage while signed in.

Do not enter real CRM data until the later workflow migration, privacy scoping, backup and recovery milestones are complete. Never describe these manual checks as passed until performed and recorded.

## Recovery and rollback

Before enabling live use, make a private copy of the Tracker Sheet and record its creation date. To disable access, deactivate the relevant `ConnectorAccess.enabled` cells or undeploy the Tracker API; access changes are checked on each protected call. A lost Apps Script cache simply requires sign-in again. The current Phase 1 test table is disposable; it is not the recovery source for CRM records.
