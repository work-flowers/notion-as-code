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

## Structure is code, data is UI

The script is the source of truth for structure; the workspace is the source of
truth for row data. There is no pull or drift detection (session state is only an
ID ledger), so any structural change made in the UI must be back-ported into the
script — otherwise it drifts silently, and script-declared fields overwrite it on
the next deploy.
