# CAT Cloud Setup and Pilot Verification

This deploys the first authenticated API for Connector Activity Tracker (CAT). The existing Appointment Companion deployment is read-only from this integration: do not change or redeploy it as part of setup.

## What exists

- Private Google Sheet: the existing CAT Cloud Store
- Existing tabs and headers: `ConnectorAccess`, `Connectors`, `CloudTestRecords`, `AuditLog`
- Added by the current source's initializer: `ConnectorProfiles` and `CRMRecords`
- Spreadsheet locale: `en_GB`; time zone: `Europe/London`
- Apps Script API source: [Code.gs](Code.gs) and [appsscript.json](appsscript.json)

The sheet has no Partner identities, access grants, Connector records, customer information or passwords. Keep it private; do not share it with Partners or publish it to the web.

## Create and configure the Apps Script project

1. Do not create another Google Sheet. Make a private backup of the existing CAT Cloud Store.
2. After the code has passed the required publication approval, in the Google account that will own CAT, create a **standalone** Apps Script project at [script.google.com](https://script.google.com/). Paste the reviewed `Code.gs` contents into its `Code.gs`; enable **Show "appsscript.json" manifest file in editor** and copy the reviewed manifest.
3. The live Companion endpoint's read-only health check returned Cloud v2.45.3. A synthetic, nonexistent Partner ID reached both `getPublicPartnerProfile` and `getPartnerProfile` and was rejected. This confirms the action routes respond, but does not verify a real Partner password or prove which Apps Script source revision is deployed. Do not change or redeploy Companion.
4. In **Project Settings → Script properties**, add:
   - `TRACKER_SHEET_ID` = the spreadsheet ID copied from the private Tracker Sheet URL (keep it in Script Properties, not in source control)
   - `COMPANION_CLOUD_URL` = the currently deployed HTTPS Web App URL in Appointment Companion's `PWA/cloud-client-v1.js`. Confirm the URL and deployment are current before using them.
5. Run `initializeTrackerCloud` from the CAT Apps Script editor. Review the requested Sheets and external-request scopes and authorise the project as its owner. It leaves the four original tabs and their rows intact, checks their headers, and creates the new `ConnectorProfiles` and `CRMRecords` tabs.
6. In the private spreadsheet, add only verified initial access rows:
   - `Connectors`: stable `connector_id`, verified display `name`, `active` set to `TRUE`.
   - `ConnectorAccess`: canonical Companion `partner_id`, matching `connector_id`, role `Admin` or `Editor`, `enabled` set to `TRUE`.
   Use the exact canonical Partner IDs from Companion, not display names. Start with one Admin and the pilot Connector. Give the second pilot Partner the appropriate role. Do not copy password/workspace-key values into this sheet. After the first Admin signs in, Connector creation, branding, and further grants are available from CAT's Setup/Admin screen.
7. Deploy as a **Web app**, executing as the project owner. The API must be reachable by the standalone PWA, including for Partners without Google accounts. The endpoint is publicly reachable; every login and data action is checked by the code. It is not a public Sheet. Never grant Partners access to the underlying Sheet.
8. Copy the deployed `/exec` URL into `cloud-config.js` as `endpoint`. This URL is public configuration, not a secret. Never put a Workspace Key, session token, spreadsheet credential or admin secret in that file.
9. Publish the updated PWA only after the separate GitHub approval restriction is resolved and the reviewed changes are approved. Do not upload through another route to avoid that review. The sign-in page remains explicit about missing setup while `endpoint` is blank.

## Authentication and access behaviour

- Sign-in sends the Partner ID and existing Companion password to the Tracker Apps Script over HTTPS in a POST body. The Tracker script verifies them through the Companion `getPartnerProfile` action. The key is not placed in a URL, written to the Tracker Sheet, returned to the browser after submission, or retained by Tracker code.
- On success, the Tracker API returns a random six-hour session token. The browser keeps that token in `sessionStorage` only. The backend stores the token hash and Partner ID in Script Cache; Google may evict cached sessions early, in which case the Partner signs in again.
- Every protected API request checks the session, rechecks the canonical Partner's active status through Companion's read-only `getPublicPartnerProfile` action, and re-reads Connector access. Disabling a Connector or access row takes effect on the next request. Disabling the Companion Partner profile also takes effect on the next request.
- A Partner must have an enabled row for an active Connector before Tracker contacts Companion. Login attempts for authorised Partner IDs are limited atomically to five per Partner and 120 total per 15-minute window using private Script Properties. Successful login resets that Partner's counter. Do not log or send a Workspace Key to support.
- CRM rows use the `CRMRecords` tab, one row per stable record ID and entity, with a Connector scope, an owner, JSON payload, version and transaction ID. Connector branding lives in `ConnectorProfiles`; the original Connector and access tabs remain the grant source of truth.
- Events and activity counts are shared among Partners assigned to that Connector. Leads, named 20Ks and customer-result details are returned only to their owner and that Connector's Admins. A Partner cannot grant themselves another Connector or change a record's Connector by editing a browser request.
- The local demo is separate from authenticated CAT data. Cloud records are cached locally per signed-in Partner, changes are queued offline, and the UI reports whether the server acknowledged them. Version conflicts retain the local pending record and show a sync error; there is no conflict-resolution screen yet.

## Browser origin and deployment

Different GitHub Pages repository paths share an origin. `sessionStorage` is scoped to a tab but is not a strong security boundary against other scripts served from the same origin. Before real CRM records are enabled in Phase 2, deploy CAT on a dedicated origin (or another isolated trusted origin) and review its script/content-security controls. A different PWA icon or repository path does not create origin isolation.

The browser API currently uses a `text/plain` POST body and expects to read a JSON acknowledgement. That avoids a JSON preflight, but does **not** prove that a separate PWA origin can read the Apps Script response: Content Service redirects responses to a `script.googleusercontent.com` URL, and Google's browser guidance demonstrates JSONP for browser callers. CAT deliberately does not use JSONP for authenticated data or `no-cors` writes. Before treating this backend as deployable, perform a harmless synthetic login/read smoke test from the actual CAT browser origin. If the browser blocks the response, put a small same-origin CORS proxy in front of Apps Script or choose a supported hosting arrangement; do not weaken the authentication or send session credentials in a URL. No such browser test has yet been run.

The server rejects requests over 30,000 characters and individual records over 24,000 characters. Apps Script does not provide a reliable client-IP rate limit here; this remains a controlled pilot endpoint, not a hardened public service for general use.

## Pilot verification checklist

Perform these checks after deployment with test accounts and test text only:

1. Correct Partner ID/password signs in; wrong password is rejected.
2. A Partner with no enabled `ConnectorAccess` row is rejected; an assigned Partner sees only assigned Connectors.
3. Create a synthetic Event and named 20K, convert it to a synthetic Lead, and confirm the versioned records appear in `CRMRecords`. Reopen CAT and confirm they load.
4. An assigned second Partner sees the Event on another device but cannot retrieve or change the first Partner's private Lead or 20K. A Connector Admin can view appropriate Connector records.
5. Disable the access row and confirm the next request is rejected. Disable the Companion Partner profile and confirm the next request is rejected.
6. Disconnect the network during a test request and confirm the UI shows an error rather than a successful cloud save.
7. Create a second synthetic Connector and branding, assign the second Partner, and verify both accounts can switch only to authorised Connectors.
8. Confirm the Sheet contains no password/workspace-key. CAT stores a Partner-specific local copy and a session token only in sessionStorage while signed in.

Do not enter real customer or prospect information until the approved release is deployed, the PWA is on a dedicated origin, live access checks and backup/recovery are verified, and the manual pilot tests above pass. Never describe these checks as passed until performed and recorded.

## Recovery and rollback

Before enabling live use, make a private copy of the CAT Cloud Store and record its creation date. To disable access, deactivate the relevant `ConnectorAccess.enabled` cells or undeploy the CAT API; access changes are checked on each protected call. A lost Apps Script cache simply requires sign-in again. The test-record table is disposable; it is not the recovery source for CRM records.
