# democo-2 — the core template, fresh deploy

The current test build of the workFlowers core template (TKT-978) in the
**workFlowers Demo** workspace. It replaces `democo`, whose re-deploy test
cleared the Meeting Notes relations (finding 33). Same spec: DemoCo HQ,
Operations and Marketing, with sample records. Engine: `ntn`, prefix `dc2`.

New in the template since `democo`: Team pinned on every layout, Project
pinned on Tasks, hidden extra columns on related tabs, and top-level page
icons in one colour per teamspace (gray in DemoCo HQ, the team's colour in a
team's).

## Deploy #1 (2026-10-16)

One run, no errors → [DemoCo HQ Home](https://app.notion.com/p/3fb6b8781c068161b5a0e6c0c02ed5f4).
Created 3 teamspaces, 13 databases and 32 pages.

| Check | Result |
| --- | --- |
| Icons | ✅ top-level pages gray in DemoCo HQ, blue in Operations, pink in Marketing |
| Page layouts and pins | ✅ checked on a meeting page: Date, Type, Attendees and Team pinned; Notes and Action Items tabs |
| Related tabs | ✅ filter to the current page, listed columns only |
| Relations | ⚠️ all landed except **Action Items**, empty on every meeting with no Tasks → Meeting back-links, on a clean first deploy. democo's first deploy wrote the same values fine. Restored through the API (kick-off: 2 tasks, planning prep: 2 tasks) |
| Board columns | ❌ reversed again (no DSL sort). Set to ascending through the API on all six boards |

This build has rows: don't re-deploy it (findings 18, 33).

## Removed (2026-10-19)

Dennis archived its three teamspaces (DemoCo HQ, Operations, Marketing) so
that `democo-3` could be deployed live for the demo video. Archived, not
deleted: they can be restored from Settings → Teamspaces.
