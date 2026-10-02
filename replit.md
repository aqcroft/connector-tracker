# Running Connector Tracker on Replit

The app is a static, local-first PWA served by the existing Node server. Replit's web preview uses the `Start application` workflow, which runs:

```sh
PORT=5000 node server.mjs
```

For local development outside that workflow, run `node server.mjs`; it defaults to port 4173. Browser data stays on the device. No cloud API, account authentication, or cloud sync is configured.

Keep the existing IndexedDB/localStorage persistence, offline service worker, Connector/Partner attribution, and version/changelog process. For any code, UI, or behavior change, update `app-meta.js`, About/What's New, and dependent cache versions.