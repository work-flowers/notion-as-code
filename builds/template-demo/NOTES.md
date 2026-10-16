# template-demo — the core template, generated from a spec

The test build for the workFlowers core template (TKT-978), in the
**workFlowers Demo** workspace (`a426b878-1c06-81cd-8ffa-0003fa91e0c8`).

Generated with:

```bash
npm run new-build -- template-demo --prefix td
```

`spec.ts` is a copy of `templates/workspace-setup/example.spec.ts` with the
company teamspace and teams renamed (Template Demo Company, TD Operations, TD
Marketing) so they can't be confused with `setup-core` in the same workspace,
plus Home-page text for TD Marketing. There is no signed-off spec doc for it;
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
| Template Demo Company | `default` | Home, plus one page per core database (Projects, Tasks, Meeting Notes, Docs), each holding its database inline |
| TD Operations | `closed` | Home (with the team-only **Vendors** database inline), plus four pages named "TD Operations Projects" etc. holding linked views filtered to Team contains TD Operations |
| TD Marketing | `closed` | Home, plus the same four filtered pages for TD Marketing |

- Standard schema and default views from the playbook. **Team** is a
  multi-select on all four databases, and team views filter on
  `enum_contains`. `setup-core` used a single select with `enum_is`.
- Relations: Projects ↔ Tasks, Projects ↔ Meeting Notes, Projects ↔ Docs
  (dual), Meeting Notes → Tasks `Action Items` (one-way). Spec-added relations
  (Vendors → Projects) are one-way.
- Spec additions: Projects gets Budget (number) and Client-facing (checkbox).
- No sample rows, no permissions, no "My …" or relative-date views.

## Compile results (2026-10-16)

`npm run check`: 40 intents (3 teamspaces, 15 pages, 13 databases, 9 view
tabs), 89 resourceIds, unique within the build and across builds. The 13
databases are 5 real ones and 8 views-only linked databases. `npm run
typecheck`: clean, including `spec.ts` against `WorkspaceSpec`. `--dry`:
session anchor `td-space` matches the demo workspace.

## Deploy #1 (2026-10-16)

One run, no errors → [Template Demo Company Home](https://app.notion.com/p/3fb6b8781c068141ace9d4964611c466).
`session.json` holds 53 new resources (3 teamspaces, 28 blocks, 5 data
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

## Post-deploy manual steps

1. In Settings → Teamspaces, confirm Template Demo Company is **Default** and
   TD Operations / TD Marketing are **Closed**. The API can't read access
   levels.
2. Save each team view's quick filter as a saved filter (finding 21): 8 views.
3. Add the "My tasks" / "My projects" / "My meetings" views and any
   relative-date views by hand. They can't be scripted.
4. Members and permissions by hand (finding 7).

**Don't re-deploy.** A re-deploy clears dual-relation values on existing rows
(finding 18), and the generator refuses to regenerate a deployed build.
