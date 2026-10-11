# Connector Activity Tracker (CAT)

Standalone, mobile-first Connector Activity Tracker (CAT) PWA. Leicester Dynamite is the initial pilot Connector; Miss England and other independent organisations use the same app with separate branding and data. The existing Event Day, 20K, Lead, appointment, outcome, follow-up and reporting workflows remain intact. Their cloud integration is implemented locally but is not live until the publication approval, Apps Script setup and browser connection checks are complete.

## Run locally

```powershell
node server.mjs
```

Open [http://localhost:4173](http://localhost:4173). Without cloud configuration the app shows the sign-in page and explains that cloud setup is pending. Select **Open the local demo** to view the sample CRM; its records remain on that device and are not cloud-synced. The service worker caches the app shell.

## Prototype data

The local demo includes clearly synthetic profiles (Demo Admin, Demo Partner A/B, Demo Lead 01–09), a Demo Connector, sample Events, 20Ks and test commission rules. The Partner switcher is a demo feature only. It is not authentication and must not be used for live CRM information.

## CAT cloud setup (not yet live)

Use the existing private CAT Cloud Store. Its four original tabs stay intact; `initializeTrackerCloud()` adds `ConnectorProfiles` for organisation branding and `CRMRecords` for versioned Events, 20Ks, Leads, outcomes, follow-ups and related CRM records. Keep its spreadsheet ID in Apps Script properties, not in this public repository.

The authenticated PWA now routes through the existing Event, Activity, 20K, Lead, appointment, outcome, follow-up and report screens. Changes save locally first and queue version-checked cloud writes; cloud sync must be confirmed by the visible status. Connector access is checked server-side, Events and Partner counts are shared within an assigned Connector, and private Lead/20K details are returned only to their owner and Connector Admins. The endpoint is still blank and the expanded Apps Script has not been deployed, so cloud operations are not yet live. Follow [cloud/SETUP.md](cloud/SETUP.md) only after the publication review is resolved.

## Versioning

The current application version and changelog live in `app-meta.js`. Every code, UI or behaviour change must update this source of truth, About, and dependent service-worker/cache versioning. Version 0.11.0 adds the CRM cloud-sync foundations and multi-Connector administration. The PWA installation name is Connector Activity Tracker (short name CAT); the repository name and stable record IDs are unchanged.

New commission calculations use the central CRM service-count rules and the £0/£50/£100/£250/£300 band lookup requested for this workflow. Existing saved commission snapshots remain as historical values. Public report links are not published in this local build; the shared report view and device share-sheet summary contain aggregate metrics only.

## Milestones

See [IMPLEMENTATION-STATUS.md](IMPLEMENTATION-STATUS.md) for the existing-feature audit and complete pass/partial/untested/deferred checklist. Live deployment, real Companion sign-in, Google Sheets round-trip, two-device access, conflict recovery and privacy testing remain outstanding.
