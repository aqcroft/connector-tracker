# Connector CRM

Standalone, mobile-first Connector Tracker PWA. The approved Event Day, 20K, Lead, appointment, outcome, follow-up and reporting workflows remain available as a clearly labelled local demo. Authenticated cloud access is being added in staged milestones.

## Run locally

```powershell
node server.mjs
```

Open [http://localhost:4173](http://localhost:4173). Without cloud configuration the app shows the sign-in page and explains that cloud setup is pending. Select **Open the local demo** to view the sample CRM; its records remain on that device and are not cloud-synced. The service worker caches the app shell.

## Prototype data

The local demo includes sample profiles, Connector, activity, 20Ks, Leads and test commission rules. The Partner switcher is a demo feature only. It is not authentication and must not be used for live CRM information.

## Phase 1 cloud setup

The Google Sheet **Connector Tracker Cloud Store - Setup Pending** has been created with the `ConnectorAccess`, `Connectors`, `CloudTestRecords` and `AuditLog` tabs, UK locale and Europe/London time zone. It contains headers only; no sample profiles, customer data, credentials or access grants were copied into it.

Follow [cloud/SETUP.md](cloud/SETUP.md) to create the standalone Apps Script project, deploy the API and add its endpoint to `cloud-config.js`. Until those steps are completed, sign-in is intentionally unavailable. The authenticated workspace currently provides a private cloud test-record create/read/update check; the main CRM workflows are scheduled for Phase 2 and remain confined to the local demo.

## Versioning

The current application version and changelog live in `app-meta.js`. Every code, UI or behaviour change must update this source of truth, About, and dependent service-worker/cache versioning. Version 0.10.0 introduces the Phase 1 authentication and cloud-check scaffolding.

New commission calculations use the central CRM service-count rules and the £0/£50/£100/£250/£300 band lookup requested for this workflow. Existing saved commission snapshots remain as historical values. Public report links are not published in this local build; the shared report view and device share-sheet summary contain aggregate metrics only.

## Milestones

See [IMPLEMENTATION-STATUS.md](IMPLEMENTATION-STATUS.md) for the existing-feature audit and complete pass/partial/untested/deferred checklist. Phase 1 cloud deployment and real-device checks are not complete until the setup and manual checks in that guide have been performed.
