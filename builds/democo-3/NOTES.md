# democo-3 — the core template, deployed live for the demo video

The current test build of the workFlowers core template (TKT-978) in the
**workFlowers Demo** workspace. Same spec as `democo-2`: DemoCo HQ,
Operations and Marketing, with sample records. Engine: `ntn`, prefix `dc3`.
Its deploy was filmed for the Notion as Code demo video
(work-flowers/workflow-walkthroughs, `walkthroughs/notion-as-code-deploy`).

Before deploying, Dennis archived democo-2's three teamspaces (DemoCo HQ,
Operations, Marketing). They're archived, not deleted, so they can be
restored. The deploy didn't clash with the archived names.

## Deploy #1 (2026-10-19)

One run, no errors → [DemoCo HQ Home](https://app.notion.com/p/3fe6b8781c06818094ebfbad784bf807).
Created 3 teamspaces, 13 databases and 32 pages. The apply took about
7 seconds, and the new teamspaces appeared in an open Notion sidebar without
a refresh.

| Check | Result |
| --- | --- |
| Relations | ⚠️ same as democo-2: everything landed except **Action Items**, which was empty on every meeting (no Tasks → Meeting back-links either). Restored through the API (kick-off: tasks 1–2, planning prep: tasks 3–4); both sides now read 2/2 |
| Board columns | ❌ reversed again (no DSL sort). Set to ascending through the API on all six boards (company Projects and Tasks, plus each team's two) |
| Team board filters | ✅ each team board reads `Team contains <team>` as its saved filter |

This build has rows: don't re-deploy it (findings 18, 33).
