# Guardrails

The alpha docs recommend a throwaway workspace. We're opted in only on the
primary work.flowers workspace, so every build here is fenced:

- **Private teamspace per build.** `accessLevel: "private"` — invisible to other
  workspace members. **Exception:** builds targeting the dedicated workFlowers
  Demo workspace (see [WORKSPACE.md](WORKSPACE.md)) may use non-private
  teamspaces. Nothing else below is relaxed there.
- **Additive-only scripts.** Every resource is net-new and parented under the
  build's own sandbox teamspace. No script may reference an existing Notion ID.
- **One mapped existing resource: the workspace itself**, used solely as the
  teamspace parent. The API cannot delete, only create and update.
- **Never hand-edit session-state files** after the initial seed. Commit each
  generated one and diff it after every run.
- **One build owns one session file.** `npm run build` refuses to run unless the
  session file maps that build's own `spaceAnchorResourceId` at that build's
  `spaceId` — mismatching them is the one mistake that duplicates or orphans a
  deployed build.
- **Auto-increment prefixes are workspace-global** (finding 6). Claim them in
  `build.json`; `npm run check` fails if two builds in one workspace collide.
- Rate limit is 5 requests/min — one deploy is one request, so not a concern.

## Seeding a new build

```
builds/<name>/
  build.json     manifest: workspace, paths, prefixes, status
  build.ts       the Notion as Code script
  session.json   the ID ledger — seeded before the first run, committed after
  NOTES.md       adaptations, probes, post-deploy manual steps
  source/        optional: extracted schema of a workspace being modelled
```

`session.json` must exist before the first run, because a run without
`--sessionStateFilePath` prompts `Continue? (y/N)` and auto-cancels in non-TTY
shells (finding 3). Seed it with the workspace anchor only — the
`spaceAnchorResourceId` must match the `resourceId` the script uses for its
`--spaceId` anchor:

```json
{
  "resourceIdToPointerMappings": {
    "<space-anchor-resource-id>": {
      "table": "space",
      "id": "<WORKSPACE_ID>",
      "spaceId": "<WORKSPACE_ID>"
    }
  },
  "resourceIdToPropertyIdMappings": {}
}
```

## Structure is code, data is UI — until the cut-off

Before any real data goes in, the script is the source of truth for structure.
There is no pull or drift detection (session state is only an ID ledger), so a
structural change made in the UI during the build must be back-ported into the
script, or script-declared fields overwrite it on the next deploy.

## Client workspaces: retire the script at the cut-off

Re-applies are destructive to a workspace in use: they clear dual-relation
values (finding 18), revert hand edits to declared fields, clear values in
undeclared properties, and never remove pages, views or automations dropped
from the script. So for a client workspace:

- **Cut-off** = go-live or the client's first real record, whichever comes
  first. After it, never run `npm run build` against that workspace again —
  not even an "additive" change.
- **After the cut-off, the client's workspace is the master copy.** Changes are
  made by hand or through the Notion MCP, approved by Dennis in the same
  conversation, with the effect on existing data checked first (deleting a
  property or changing its type still loses values). Log them on the client's
  project, not in `builds/<name>/`.
- Set `status` in the build's `build.json` to `retired` at the cut-off, and note
  the date in its `NOTES.md`. The script stays as a record of the first build.
  (`npm run build` doesn't check this status yet, so it's a convention, not a
  lock.)
- Copy a change into the core template only if it should apply to future
  clients.
- **Add-ons after go-live** (e.g. CRM) are built by hand or MCP: Notion as Code
  can't reference resources it didn't create, so a separate build couldn't
  relate to the existing databases.
