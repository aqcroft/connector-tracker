# Connector Tracker working rules

For every future code, UI, or behaviour change in this repository, automatically:

1. Update the application version using the single source of truth in `app-meta.js`.
2. Update the current-version change summary and lightweight changelog.
3. Ensure Setup/Admin -> About displays the new version and changes.
4. Update cache versioning that depends on the application version.
5. Do this without requiring Adrian to request it.

Use semantic versioning: PATCH for fixes and small polish changes, MINOR for meaningful new functionality or substantial UX/workflow changes, and MAJOR only when explicitly appropriate or requested.
