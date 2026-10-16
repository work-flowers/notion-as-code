# template-demo — the core template, generated from a spec

The test build for the workFlowers core template (TKT-978), in the
**workFlowers Demo** workspace (`a426b878-1c06-81cd-8ffa-0003fa91e0c8`).

Generated with:

```bash
npm run new-build -- template-demo --prefix td
```

`spec.ts` is a copy of `templates/workspace-setup/example.spec.ts` with the
company teamspace named DemoCo HQ, plus Home-page text for Marketing. It was
first deployed as Template Demo Company / TD Operations / TD Marketing, to keep
it apart from `setup-core`, and renamed in deploy #3 once `setup-core` was
removed. There is no signed-off spec doc for it;
`specDocUrl` points at the TKT-978 task.

## Why a generator

A build script can't import a spec. The SDK copies the script into a function
body in a temp directory and runs that, so `import` is a syntax error there and
`require` can't resolve a relative path or load TypeScript. So
`tools/new-build.ts` writes a self-contained `build.ts`: the `WorkspaceSpec`
types, the spec as a literal, and the template function, copied from
`templates/workspace-setup/`. The build directory is then a complete record of
what was deployed.

## Model

| Teamspace | Access | Contents |
| --- | --- | --- |
| DemoCo HQ | `default` | Home, plus one page per core database (Projects, Tasks, Meeting Notes, Docs), each holding its database inline |
| Operations | `closed` | Operations Home (with the team-only **Vendors** database inline), plus four pages named "Operations Projects" etc. holding linked views filtered to Team contains Operations |
| Marketing | `closed` | Marketing Home, plus the same four filtered pages for Marketing |

- Standard schema and default views from the playbook. **Team** is a
  multi-select on all four databases, and team views filter on
  `enum_contains`. `setup-core` used a single select with `enum_is`.
- Relations: Projects ↔ Tasks, Projects ↔ Meeting Notes, Projects ↔ Docs
  (dual), Meeting Notes → Tasks `Action Items` (one-way). Spec-added relations
  (Vendors → Projects) are one-way.
- Spec additions: Projects gets Budget (number) and Client-facing (checkbox).
- "My projects" (Owner), "My tasks" (Assignee) and "My meetings" (Attendees)
  tabs filter on the viewer, `me`. Added in deploy #2.
- No sample rows, no permissions, no relative-date views.

## Compile results (2026-10-16)

`npm run check`: 40 intents (3 teamspaces, 15 pages, 13 databases, 9 view
tabs), 89 resourceIds, unique within the build and across builds. The 13
databases are 5 real ones and 8 views-only linked databases. `npm run
typecheck`: clean, including `spec.ts` against `WorkspaceSpec`. `--dry`:
session anchor `td-space` matches the demo workspace.

## Deploy #1 (2026-10-16)

One run, no errors → [Template Demo Company Home](https://app.notion.com/p/3fb6b8781c068141ace9d4964611c466).
`session.json` held 53 new resources (3 teamspaces, 28 blocks, 5 data
sources, 17 views) and 36 properties, plus the workspace anchor. `setup-core`
and `default-teamspace-probe` were removed from the workspace first, so these
are the only script-built teamspaces in it.

Checked through the API afterwards. The row checks used 5 test rows created
through the API, which were trashed afterwards, so the build has no rows.

| Check | Result |
| --- | --- |
| Schemas match the playbook | ✅ all four core databases have the standard properties, Status options Not started / In progress / Done / Cancelled, and Team as a multi-select with TD Operations / TD Marketing. Projects also has Budget and Client-facing from the spec |
| Relations pair correctly | ✅ Projects ↔ Tasks, ↔ Meeting Notes and ↔ Docs are `dual_property` with the right synced names. Action Items and Vendors → Projects are one-way. Test rows read correctly from both sides, including Tasks → Project (compare finding 22) |
| Multi-select team filter | ✅ each team view has `quick_filters: {"multi_select": {"contains": [<team>]}}`. A task tagged with both teams matches both; an Operations-only task matches Operations only. Still a quick filter (finding 21) |
| Views exist | ✅ Projects: Board, Timeline. Tasks: Board, All tasks. Meeting Notes: By date, Calendar. Docs: All docs, By type. Vendors: All vendors. Plus one linked view per team per core database (8), named after the team |
| Placement | ✅ core databases inside their Company pages, team linked views inside the "TD … " pages, Vendors inside TD Operations Home |

## Deploy #2 (2026-10-16): "My" tabs

The template first left the "My" views as a manual step, on the belief that
scripts can't filter on the current user. They can: the DSL's person filter
takes `{ type: "relative", value: "me" }`, as `crm` already used. The template
now adds My projects, My tasks and My meetings.

Regenerated with `npm run new-build -- template-demo --prefix td --force`,
which first checked that every database was empty, then re-deployed. One run,
no errors: 3 new view mappings, and no existing mapping changed.

| Check | Result |
| --- | --- |
| The three tabs exist on the right databases, with their sorts | ✅ |
| Their `me` filters | ⚠️ read back `null` in both `filter` and `quick_filters`, as for crm's My Emails / My Meetings. Only the UI can confirm them |

## Deploy #3 (2026-10-16): renames

The company teamspace became **DemoCo HQ** and the teams **Operations** and
**Marketing**. The template now titles a team's Home page "<Team> Home"
(Operations Home, Marketing Home); the company Home stays "Home". Regenerated
with `--force` (every database still empty) and re-deployed. One run, no
errors, and no mapping added or changed.

| Check | Result |
| --- | --- |
| Page titles | ✅ Operations Home, Marketing Home, "Operations Tasks", "Marketing Docs" and so on |
| Team multi-select options | ✅ renamed in place to Operations / Marketing on all four databases, with no leftover "TD …" options |
| Team views | ✅ tabs named Operations / Marketing, quick filters `contains ["Operations"]` / `["Marketing"]` |
| Teamspace names | ⚠️ not readable through the API; check in the UI (finding 24 left open whether a re-deploy renames a teamspace) |

## Deploy #4 (2026-10-16): moved to the `ntn` engine

Regenerated with `npm run new-build -- template-demo --prefix td --force`
(every database still empty) after the template moved to `ntn` (finding 30).
`build.json` now has `"engine": "ntn"`, and each team view wraps its Team
filter in a one-member `and` group so it deploys as a saved filter
(finding 27). The resourceIds are unchanged: the SDK and `ntn` compiles both
claim the same 93, including every mapping in `session.json`. `check`,
`typecheck` and `--dry` pass (43 intents).

Re-deployed through `ntn` with Dennis's go-ahead. One run, no errors: 0
resources created and all 57 resource IDs unchanged. `session.json` is now in
`ntn`'s shape (finding 26), so **this build can't go back to the SDK runner.**

| Check | Result |
| --- | --- |
| Team views (8) | ✅ each reads `filter: {multi_select: {contains: [<team>]}}` with `quick_filters: null`: a saved filter, not a quick filter. The server drops the one-member `and` wrapper (finding 30) |
| My projects / My tasks / My meetings | ⚠️ still `filter: null, quick_filters: null`, as on the SDK runner. Only the UI can confirm them |

## Deploy #5 (2026-10-16): more tabs, mirrored team tabs, sample records

Template changes: Projects gains **All projects** and **Active projects**
(Status is In progress), Tasks gains **Open tasks** (Status is not Done or
Cancelled), Docs **By type** becomes a table grouped by Type, and every team
page shows all of its database's tabs, each filtered to the team as a saved
filter. The spec gets `sampleRecords: true`: 3 projects, 6 tasks, 3 meeting
notes, 3 docs and 2 vendors, dated around the sign-off date, with relation
values on the "many" side only. One project is tagged with both teams.

Regenerated with `--force` (still no rows), then deployed with Dennis's
go-ahead. One run, no errors: 17 pages created and 33 view tabs mapped.

| Check | Result |
| --- | --- |
| Company tabs | ✅ Projects: Board, Timeline, All projects, Active projects, My projects. Tasks: Board, All tasks, Open tasks, My tasks. Meeting Notes: By date, Calendar, My meetings. Docs: All docs, By type |
| Docs By type | ❌ still a **board** on the company database: a re-deploy can't change a view's type (finding 31). The team By type tabs are new, so they're tables |
| Team tabs (28) | ✅ the same tabs on every team page, each with a saved filter for its team, combined with the tab's own filter in an `and` group |
| Sample rows | ✅ 3 / 6 / 3 / 3 / 2, with Team values as written. A Team contains Marketing query returns the cross-team project |
| Relations | ✅ every two-way value reads from both sides, including Tasks → Project (finding 32). Action Items and Vendors → Projects as written |
| My … tabs | ⚠️ the `me` filter doesn't read back (company tabs read `null`; team tabs show only the Team member), so check in the UI |

**This build now has rows**, so it's past the point where it can be
regenerated or re-deployed: `--force` refuses, and a re-deploy would clear the
sample relation values (finding 18). Test further template changes in a new
build with its own prefix.

## After deploy #5: changes through the API (2026-10-16)

This build has rows, so it can't be re-deployed. These changes were made
through the public API instead, with Dennis's go-ahead, and copied into the
template for future builds. `build.ts` stays the record of deploy #5, so it
no longer matches the workspace on these points:

- **Budget removed** from Projects (`PATCH /v1/data_sources/{id}` with
  `Budget: null`), along with its 3 sample values. Also removed from
  `spec.ts` and `example.spec.ts`.
- **Board views (6: company + both teams, Projects and Tasks)** now group by
  status **option** instead of status group, with columns sorted
  **ascending** (option order: Not started, In progress, Done, Cancelled).
  Cards show Priority and Owner (Projects) and Assignee, Due, Priority and
  Project (Tasks), plus Team on the DemoCo HQ boards only: on a team page
  every card has that team, so it's left off. Team filters were unchanged by
  the patch.
- **Company Projects Timeline re-centred on today.** It read
  `preference: {zoom_level: "month", center_timestamp: <2 Jan 2027>}`. At
  month zoom that shows about mid-December to mid-January, after every sample
  project ends, so the timeline looked empty. The script sets no preference
  (the DSL has none), and the team Timelines had none. Patched to centre on
  2026-10-16.
- **Emoji icons** on the three sample projects (🌐 Website refresh,
  🗓️ Quarterly planning, 🧭 Team onboarding guide), via `PATCH /v1/pages`.

The template gives new builds `statusBy: "option"` and the card properties.
The DSL has no setting for the column sort, so whether a fresh deploy puts
Not started first is untested.

## Post-deploy manual steps

1. ✅ In Settings → Teamspaces, the company teamspace is **Default** and the
   two team teamspaces are **Closed** (confirmed by Dennis after deploy #2).
   After deploy #3, also check they're named DemoCo HQ, Operations and
   Marketing.
2. ~~Save each team view's quick filter.~~ Done by the script since deploy #4.
   Check in the UI that the filter bar shows no removable "Team" pill.
3. Check that My projects, My tasks and My meetings each show a "… contains
   Me" filter, on the company databases and on the team pages.
4. Change the company Docs **By type** view's layout to **Table** (finding 31).
   Changing the layout in the UI keeps the view's ID.
5. Check the tab order on each database matches the script. The API can't
   read it. Projects shows My projects before All projects and Active
   projects, because My projects was created in an earlier deploy: drag it to
   the end.
6. Members and permissions by hand (finding 7).

**Don't re-deploy.** A re-deploy clears dual-relation values on existing rows
(finding 18), and the generator refuses to regenerate a deployed build.
