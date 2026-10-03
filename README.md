# Connector CRM

Standalone, mobile-first PWA prototype for Leicester Dynamite Connector activity and results. It includes the core workflows from the supplied build brief and persists local changes in IndexedDB, with a localStorage fallback.

## Run locally

```powershell
node server.mjs
```

Open [http://localhost:4173](http://localhost:4173). The service worker caches the app shell for offline use. Browser data stays on the device; the outbox is prepared for future sync, but no cloud endpoint is connected.

## Next Action UX experiment

Open the public, phone-friendly [Next Action UX branch preview](https://htmlpreview.github.io/?https://github.com/aqcroft/connector-tracker/blob/ux-next-action-experiment/index.html). Its sample workspace uses separate browser storage from the main app; preview data remains on that device and does not sync between devices. GitHub Pages is currently restricted to deploy from `main`, so the branch preview uses GitHub's HTML preview service instead of changing the repository's Pages deployment settings.

## Prototype data

The initial dataset includes Adrian, Salima, Destiny, Leicester Dynamite, a sample 20K activation, sample Leads, and editable test commission rules. The sample Partner switcher is for previewing roles on one device. A real authenticated account and server-side Connector access check must be added with the cloud API.

## Versioning

The current application version and changelog live in `app-meta.js`. Every future code, UI, or behaviour change must increment the semantic version, update its change summary, keep Setup/Admin -> About current, and update dependent cache versioning automatically. Use PATCH for fixes and small polish, MINOR for meaningful functionality or substantial workflow changes, and MAJOR only when explicitly appropriate.

New commission calculations use the central CRM service-count rules and the £0/£50/£100/£250/£300 band lookup requested for this workflow. Existing saved commission snapshots remain as historical values. Public report links are not published in this local build; the shared report view and device share-sheet summary contain aggregate metrics only.
