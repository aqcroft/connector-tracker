window.APP_META = {
  version: '0.11.2',
  released: '2026-10-11',
  summary: [
    'Added a prominent Connector switcher to the main header on desktop and mobile; Setup/Admin now uses an explicit Open workspace button',
    'Clarified that the UW Partner ID uses a separate Team Triumph tools password, not the UW Partner Portal password',
    'Kept authenticated Partner identity separate from the old device-only demo Partner switcher',
    'Refreshed the UW-style CAT icon cache across the browser tab and PWA without touching Connector-specific logos or saved data'
  ],
  history: [
    { version: '0.11.2', date: '2026-10-11', summary: 'Added header Connector switching, unambiguous Team Triumph login guidance, authenticated profile separation and icon-cache refresh.' },
    { version: '0.11.1', date: '2026-10-11', summary: 'Fixed stale PWA navigation, gated the online pilot, refreshed shared Connector branding, and preserved legacy device-only sample data.' },
    { version: '0.11.0', date: '2026-10-11', summary: 'Connected existing CRM workflows to a queued, version-checked cloud record API; added Connector profiles and Partner grants, cloud refresh, and server-side private Lead scoping. Deployment and live cloud verification remain pending.' },
    { version: '0.10.2', date: '2026-10-11', summary: 'Named the PWA Connector Activity Tracker (CAT) and documented the staged multi-Connector cloud plan; preserved repository identity, record IDs, local data and authentication.' },
    { version: '0.10.1', date: '2026-10-11', summary: 'Hardened cloud sign-in allowlisting, persistent rate limits and test-record ownership checks; anonymized demo identities and removed the private sheet identifier from public setup text.' },
    { version: '0.10.0', date: '2026-10-10', summary: 'Added the Phase 1 authenticated cloud workspace, shared Partner identity verification, Connector access checks and a cloud test-record workflow; existing CRM records remain local-only until Phase 2.' },
    { version: '0.9.0', date: '2026-10-04', summary: 'Event Day simplification, Event-wide progress breakdown, direct 20K conversion, compact follow-ups and SIM selection, mobile report navigation, and corrected Connector commission.' },
    { version: '0.8.0', date: '2026-10-03', summary: 'Linked funnel records, reliable appointment and follow-up workflows, detailed leakage lists, service commission lookup, and configurable profiles and branding.' },
    { version: '0.7.1', date: '2026-10-03', summary: 'Fixed Action Inbox outcome updates and aligned historical customer result labels.' },
    { version: '0.7.0', date: '2026-10-03', summary: 'Named Event 20Ks, one-way Lead creation, simpler mobile navigation, independent progression milestones and compact funnel reporting.' },
    { version: '0.6.0', date: '2026-10-02', summary: 'Event Day workspace, persistent colour-coded navigation and simpler access to Leads, Follow-ups and reporting.' },
    { version: '0.5.0', date: '2026-10-02', summary: 'Mobile launcher, contextual navigation and browser Back refinement.' },
    { version: '0.4.0', date: '2026-10-02', summary: 'UX simplification pass for everyday mobile work.' },
    { version: '0.3.0', date: '2026-10-01', summary: 'Lead outcomes, drill-down metrics and commission reference.' },
    { version: '0.2.0', date: '2026-09-30', summary: 'Follow-ups, Action Inbox and event workspace improvements.' }
  ]
};
