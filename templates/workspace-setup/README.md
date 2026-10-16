# Core workspace template

The workFlowers base template for a **New workspace setup** engagement
(TKT-978). From a client's signed-off spec, it generates a self-contained
build in `builds/<client>/` that deploys:

- An all-company teamspace with `default` access, holding a Home page and one
  page per core database: Projects, Tasks, Meeting Notes, Docs.
- The playbook's standard schema and these tabs:

  | Database | Tabs |
  | --- | --- |
  | Projects | Board (by status), Timeline (by Dates, earliest first), All projects, Active projects (In progress), My projects |
  | Tasks | Board (by status), All tasks, Open tasks (not Done or Cancelled), My tasks |
  | Meeting Notes | By date (newest first), Calendar, My meetings |
  | Docs | All docs, By type (table grouped by Type) |

  Boards have one column per status option. Projects cards show Priority
  and Owner; Tasks cards show Assignee, Due, Priority and Project. Company
  boards also show Team; team pages leave it off, since every row there has
  that team. "My …" tabs
  filter on the viewer (`me`). Every database has **Team**, a multi-select with one option per team, plus the
  standard relations: Projects ↔ Tasks, Projects ↔ Meeting Notes, Projects ↔
  Docs, and Meeting Notes ↔ Tasks (`Action Items`, with `Meeting` on
  Tasks).
- Page layouts on the four core databases, following the
  clean-database-page-layouts principles:

  | Database | Pinned under the title | Own block | Side pane "Details" | Tabs |
  | --- | --- | --- | --- | --- |
  | Projects | Status, Owner, Dates, Priority, Team | Summary | Spec-added properties; Tasks, Meeting Notes, Docs hidden | Overview, Tasks, Meeting Notes, Docs |
  | Meeting Notes | Date, Type, Attendees, Team | — | Project; Action Items hidden | Notes, Action Items |
  | Tasks | Status, Assignee, Due, Priority, Project, Team | — | Meeting | — |
  | Docs | Type, Owner, Last reviewed, Team | — | Project | — |

  Each related tab is a view on the related database, filtered to rows whose
  relation contains the page being viewed (`this_page`), and marked
  `ephemeral` so it isn't one of that database's own tabs.
- One teamspace per team, at the access level the spec gives it, holding a
  Home page ("<Team> Home") and pages named "<Team> Projects", "<Team> Tasks"
  and so on. Each shows the company database with the same tabs, every one
  also filtered to Team contains that team, as a saved filter.
- Top-level page icons in one colour per teamspace: gray in the company
  teamspace, the team's colour in a team's (its Home keeps the team's icon).
- The spec's extra core properties and team databases. Team databases are
  nested in their team's Home page.

- With `sampleRecords: true` in the spec, example rows in every database:
  3 projects with emoji icons (one tagged with every team), 6 tasks, 3 meeting notes, 3 docs
  and 2 rows per team database, dated around the sign-off date. Relation
  values are written on one side, and pair on both sides on `ntn`
  (finding 32). Spec-added properties get placeholder values.

There are no permissions and no relative-date views. **Sample records end the
build's re-deploy window:** once a build has rows, `--force` refuses to
regenerate it, and a re-deploy would clear their relation values (finding 18).
So deploy them on the first and only deploy.

Generated builds run on the **`ntn` engine** (`"engine": "ntn"` in
`build.json`, see [AGENTS.md](../../AGENTS.md)): they type-check against
`vendor/ntn-template` and deploy through `ntn notion-as-code apply`. The
template uses the 2026-10-06 DSL's filter shapes (finding 30) and its `and`
groups (finding 27), so it no longer compiles on the SDK runner. The design lives in the playbook's Standard
schema section:
[Playbook: New Notion Workspace Setup](https://app.notion.com/p/3fb91b0711ac81c59c44eea9bfbc608c).

| File | What it is |
| --- | --- |
| `spec.ts` | The `WorkspaceSpec` type. Each section maps to a numbered section of the spec doc |
| `example.spec.ts` | An example spec, the starting point for a client's |
| `template.ts` | The template: `buildWorkspace(spec, prefix, spaceAnchor)` |
| `validate.ts` | Checks the type can't express (option lists, relation targets, duplicate keys and names…) |
| `../../tools/new-build.ts` | The generator |

## Generating a client build

1. **Convert the signed-off spec doc** into `builds/<client>/spec.ts`. Copy
   `example.spec.ts` and point its import at
   `../../templates/workspace-setup/spec`. Set `engagement.workspaceId` to the
   client's workspace, and `signedOffOn` to the sign-off date.
2. **Generate the build:**

   ```bash
   npm run new-build -- <client> --prefix <p>
   ```

   `--prefix` starts every resourceId (e.g. `acme` → `acme-projects-db`). Use
   2–8 lowercase letters or digits, unique among the repo's builds, and never
   change it after a deploy. Pass `--spec <path>` to generate from a spec kept
   elsewhere; it's copied into the build directory.

   The generator validates the spec and lists every problem at once. If the
   spec is valid, it writes `build.ts`, `build.json` (status `not-deployed`)
   and a `session.json` seeded with the workspace anchor. `ntn` rewrites
   `session.json` in its own shape on the first deploy (finding 26). If another build
   already targets that workspace, the generator copies its `tokenRef` into
   `build.json`. For a new client workspace, add the `tokenRef` yourself (see
   [docs/WORKSPACE.md](../../docs/WORKSPACE.md)) and register the workspace
   there.
3. **Check it:**

   ```bash
   npm run check -- <client>
   npm run typecheck -- <client>
   npm run build -- <client> --dry
   ```

   `typecheck` also checks `spec.ts` against `WorkspaceSpec`.
4. **Deploy once, into an empty workspace**, after Dennis gives the go-ahead:

   ```bash
   npm run build -- <client>
   ```

   Then commit `session.json`, and set `status`, `deployedAt` and `hubUrl` in
   `build.json`.

Until the first deploy you can edit `spec.ts` and regenerate as often as you
like. After it, the generator refuses to regenerate: `build.ts` is the record
of what was deployed. The exception is `--force`, which regenerates a deployed
build only if every one of its databases is still empty (it checks through the
API), and keeps `session.json`. Use it to pick up a template change before any
rows exist, then re-deploy. Once rows exist, a re-deploy would clear their
relation values (finding 18). `--force` reads both `session.json` shapes, so
it works on builds deployed through either engine. Regenerating a build that
was deployed through the SDK runner moves it to `ntn`, and its next deploy
can't be moved back (finding 26).

**Why generate, not import:** a build script can't import another file
(finding 29), so `build.ts` carries its own copy of the spec types, the spec
and the template. Don't edit it by hand. Change the template, or the spec
before the first deploy, and regenerate.

## Post-deploy manual steps

Notion as Code can't do these (see the playbook's Notion as Code section and
[docs/FINDINGS.md](../../docs/FINDINGS.md)):

1. **Check teamspace access levels** in Settings → Teamspaces. The company
   teamspace should be Default, and each team's should match the spec. The API
   can't read them back.
2. **Delete the pre-installed default teamspace** if it's empty (finding 23).
3. ~~Save the team views' filters.~~ No longer needed. Each team view wraps
   its Team filter in a one-member `and` group, which deploys as the view's
   saved filter, not a removable quick filter (findings 21, 27, 30).
4. **Check the "My" tabs** (My projects, My tasks, My meetings), on the
   company databases and the team pages, show a "… contains Me" filter. The
   API doesn't read a `me` filter back (findings 30, 32), so the UI is the
   only check.
5. **Check the board column order** is Not started, In progress, Done,
   Cancelled. The DSL can't set it; if it's wrong, set the group sort to
   ascending in the view's Group settings.
6. **Check the Projects Timelines show their rows** (company and team
   pages). One deploy's showed none until patched (see FINDINGS, template
   refinements section). Click Today too: a timeline saves its scroll
   position, and the DSL can't set it.
7. **Add relative-date views** such as "due this week" by hand (finding 4).
8. **Set up database templates** for Meeting Notes, Tasks and so on. They
   aren't in the scripting language.
9. **Build Home-page charts and dashboards** (finding 8), **buttons and
   automations** (finding 9), and **number formats** such as percent
   (finding 11) where the spec asks for them.
10. **Apply permissions and teamspace membership** in phase 4, from the
   permissions plan (finding 7).
11. At handover, each user sets the company Meeting Notes database as their
   default destination for Notion AI meeting notes. It's a per-user setting.

## After deploy

Don't re-deploy a client build with data in it: a re-deploy clears every
two-way relation value on existing rows (finding 18). At the cut-off (go-live,
or the client's first real record, whichever comes first) set the build's
status to `retired`. From then on the client workspace is the master copy, and
changes are made by hand or through the Notion MCP (see
[docs/GUARDRAILS.md](../../docs/GUARDRAILS.md)).

The CRM add-on isn't supported yet. A spec with `addOns.crm: true` fails
validation.
