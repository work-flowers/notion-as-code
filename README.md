# Notion as Code

Testing Notion's **Notion as Code** alpha (declarative TypeScript → workspace
deploys) by building realistic client systems as code and recording what the
alpha can and can't express.

Each build is a directory under `builds/`, deployed into its own **private
sandbox teamspace** in the work.flowers workspace — see
[docs/GUARDRAILS.md](docs/GUARDRAILS.md) for why, and
[docs/WORKSPACE.md](docs/WORKSPACE.md) for the deploy targets.

| Build | What it is | Status |
| --- | --- | --- |
| [`knoxx-rnd`](builds/knoxx-rnd/NOTES.md) | Knoxx Innovations R&D management & evidence system — Projects / Activities / Knowledge + ATO audit views | deployed 2026-07-24 |
| [`crm`](builds/crm/NOTES.md) | work.flowers CRM — Contacts / Companies / Deals, Meetings, Emails, views, sample records | deployed 2026-07-25 |
| [`setup-core`](builds/setup-core/NOTES.md) | Demo workspace: open Company teamspace with core databases, plus Operations / Marketing teamspaces showing filtered views of them | removed 2026-10-16 |
| [`template-demo`](builds/template-demo/NOTES.md) | Demo workspace: the core template (TKT-978) generated from the example spec. Default company teamspace (DemoCo HQ), four core databases, two team teamspaces with filtered views | removed 2026-10-16 |
| [`democo`](builds/democo/NOTES.md) | Demo workspace: the core template (TKT-978) with page layouts and sample records. DemoCo HQ (default), Operations, Marketing | removed 2026-10-16 |
| [`democo-2`](builds/democo-2/NOTES.md) | Demo workspace: the core template (TKT-978) with page layouts and sample records. DemoCo HQ (default), Operations, Marketing | removed 2026-10-19 |
| [`democo-3`](builds/democo-3/NOTES.md) | Demo workspace: democo-2's spec, deployed live for the Notion as Code demo video. DemoCo HQ (default), Operations, Marketing | deployed 2026-10-19 |
| [`default-teamspace-probe`](builds/default-teamspace-probe/NOTES.md) | Demo workspace: a script can create the all-company teamspace as a workspace default, alongside the pre-installed one (on create only) | removed 2026-10-16 |
| [`dsl-recheck-probe`](builds/dsl-recheck-probe/NOTES.md) | Demo workspace: checks whether the DSL `ntn` 0.23.20 ships fixes findings 4, 9, 12 and 14, plus feed views and `this_page` page-layout tabs. First build on the `ntn` engine | deployed 2026-10-16 |
| [`meetings-probe`](builds/meetings-probe/NOTES.md) | Demo workspace: attendee-only Meeting Notes layout (TKT-1032). Source database in a private admin teamspace, linked views and a Projects `this_page` tab in an open one | not deployed |

**Findings so far: [docs/FINDINGS.md](docs/FINDINGS.md)** — the actual output of
this repo, and what gets fed back to Notion.

## Layout

```
builds/<name>/
  build.json     manifest: workspace, paths, prefixes, status
  build.ts       the Notion as Code script
  session.json   session state (resourceId → Notion ID ledger) — COMMIT THIS
  NOTES.md       adaptations, probes, post-deploy manual steps
  source/        extracted schema of a workspace being modelled (crm only)
tools/
  builds.ts        manifest loading + the session ↔ workspace safety checks
  run.ts           deploy a build by name
  compile-check.ts compile to intents, check resourceIds (no Notion call)
  typecheck.ts     tsc a build against the DSL declarations
  pull-schema.ts   extract an existing database's schema + views
  ntn.ts           the "ntn" engine: compile against vendor/ntn-template
docs/            FINDINGS.md · GUARDRAILS.md · WORKSPACE.md
vendor/ntn-template/  DSL types + runtime from notion-as-code-template, for "engine": "ntn" builds
notion-sdk-js/   Local clone of makenotion/notion-sdk-js @ EXPERIMENTAL__notion-as-code (gitignored)
```

## Setup

```bash
git clone --branch EXPERIMENTAL__notion-as-code https://github.com/makenotion/notion-sdk-js.git
cd notion-sdk-js && npm install
```

Nothing to install at the repo root — the npm scripts borrow `tsx` and `tsc`
from that checkout. Auth is a Personal Access Token read from 1Password at run
time (details in [docs/WORKSPACE.md](docs/WORKSPACE.md)); `$NOTION_TOKEN` wins if
it's already exported.

## Generating a client build from a spec

The core workspace template lives in `templates/workspace-setup/`. See its
[README](templates/workspace-setup/README.md) for how to turn a signed-off spec
into a deployable build with `npm run new-build`.

## Working on a build

```bash
npm run build                  # list builds and their status
npm run check                  # compile every build; check resourceId + prefix collisions
npm run typecheck              # tsc every build against the DSL types
npm run build -- crm --dry     # show exactly what a deploy would run, touch nothing
npm run build -- crm           # deploy / re-deploy
```

Always `check` and `typecheck` before a deploy: the compile step proves the
script runs and its resourceIds are unique, and the type check catches illegal
property types, view configs and filter shapes. A run is one API request, and
mistakes land in a real workspace.

`npm run build` resolves the script, session file and workspace ID from
`build.json` — deploys are never assembled by hand — and refuses to run if the
session file doesn't anchor that build in that workspace. After a run, commit the
updated `session.json`, and on a first deploy update `status` / `deployedAt` /
`hubUrl` in the manifest.

## Modelling an existing workspace

```bash
npm run pull -- --database=<databaseId> --out=builds/<name>/source
```

Dumps schema and view configuration (including views, which are undocumented in
the SDK) as raw JSON plus readable summaries. There is no import path in Notion
as Code, so the script itself is still written by hand from that output — see
[finding 16](docs/FINDINGS.md).
