# Core workspace template

The workFlowers base template for a **New workspace setup** engagement
(TKT-978). From a client's signed-off spec, it generates a self-contained
build in `builds/<client>/` that deploys:

- An all-company teamspace with `default` access, holding a Home page and one
  page per core database: Projects, Tasks, Meeting Notes, Docs.
- The playbook's standard schema and default views on those databases, plus
  "My projects", "My tasks" and "My meetings" tabs that filter on the viewer
  (`me`). Every
  database has **Team**, a multi-select with one option per team, plus the
  standard relations: Projects ↔ Tasks, Projects ↔ Meeting Notes, Projects ↔
  Docs, and Meeting Notes → Tasks (`Action Items`).
- One teamspace per team, at the access level the spec gives it, holding a
  Home page and pages named "<Team> Projects", "<Team> Tasks" and so on. Each
  shows the company database filtered to Team contains that team.
- The spec's extra core properties and team databases. Team databases are
  nested in their team's Home page.

There are no permissions, no sample rows and no relative-date views. The design lives in the playbook's Standard
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
   and a `session.json` seeded with the workspace anchor. If another build
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
relation values (finding 18).

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
3. **Save the team views' filters.** Script filters land as quick filters that
   any viewer can clear (finding 21). There's one per team per core database.
4. **Check the "My" tabs** (My projects, My tasks, My meetings) show a
   "… contains Me" filter. The API reads a `me` filter back as `null`, so the
   UI is the only check.
5. **Add relative-date views** such as "due this week" by hand (finding 4).
6. **Set up database templates** for Meeting Notes, Tasks and so on. They
   aren't in the scripting language.
7. **Build Home-page charts and dashboards** (finding 8), **buttons and
   automations** (finding 9), and **number formats** such as percent
   (finding 11) where the spec asks for them.
8. **Apply permissions and teamspace membership** in phase 4, from the
   permissions plan (finding 7).
9. At handover, each user sets the company Meeting Notes database as their
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
