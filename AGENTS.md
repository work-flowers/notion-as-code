# Notion as Code

This repo builds realistic Notion systems as declarative TypeScript (Notion's
**Notion as Code** alpha) and records what the alpha can and can't express. Each
build deploys into its own private sandbox teamspace in the **real**
work.flowers workspace, so mistakes are live.

Read these before changing anything:

- [README.md](README.md) — layout, setup, the build commands.
- [docs/GUARDRAILS.md](docs/GUARDRAILS.md) — the fences every build must stay
  inside. They are rules, not suggestions.
- [docs/FINDINGS.md](docs/FINDINGS.md) — known bugs and gaps. Check it before
  working around a limitation, and before reporting one as new.
- [docs/WORKSPACE.md](docs/WORKSPACE.md) — deploy targets and auth.
- `builds/<name>/NOTES.md` — per-build adaptations and post-deploy manual steps.

This repo is **not** based on `makenotion/notion-as-code-template`. It runs on a
local clone of `makenotion/notion-sdk-js` at the `EXPERIMENTAL__notion-as-code`
branch (gitignored, at `notion-sdk-js/`) and deploys through `npm run build`,
not `ntn notion-as-code apply`. Don't port template conventions (`src/main.ts`,
`src/lib/`, `dist/intents.json`, `ntn` state) into this repo.

**Exception: the `ntn` engine.** The SDK branch hasn't moved since `3d33935`
(2026-07-23); the current DSL ships with `ntn` (finding 25). A build whose
`build.json` sets `"engine": "ntn"` compiles against `vendor/ntn-template` (the
template's types and runtime, unchanged) and deploys through
`ntn notion-as-code apply --state <its session.json>`. It still uses this
repo's conventions: a `build.ts` with the global `notion`, `npm run build`, and
a committed `session.json`. For those builds the DSL reference is
`vendor/ntn-template/types.d.ts`, and the Markdown spec is
`NotionAsCodeMarkdownSpec` in it.

## Authoring rules

- Scripts are declarative. `notion` is a global that the SDK runner provides,
  so build scripts don't import it. Calls like `notion.teamspace(...)` only
  record intents; nothing reaches Notion until a deploy.
- Every resource needs a stable, unique `resourceId`. Session state maps
  `resourceId`s to real Notion IDs, so **never rename or remove a `resourceId`
  after a deploy**: the next run would create a duplicate and orphan the
  original, and the API can't delete. `npm run check` catches collisions
  within a build and across builds, but it can't catch renames.
- One workspace anchor per build. The script parents its teamspace on
  `{ type: "resourceId", resourceId: <spaceAnchorResourceId> }`, and that ID
  must match `spaceAnchorResourceId` in `build.json` and the anchor seeded in
  `session.json`.
- Additive only. Every resource is net-new and lives under the build's own
  private teamspace (`accessLevel: "private"`) — except in the demo workspace,
  where a build's teamspaces may be non-private (see docs/GUARDRAILS.md). Never reference an existing
  Notion page, database or data source ID.
- Claim auto-increment ID prefixes in `build.json` (`autoIncrementPrefixes`).
  They are workspace-global.
- Page `content` uses Notion-flavoured Markdown. The full spec is
  `INFRA_AS_CODE_MARKDOWN_SPEC` in the DSL types (below), but the server can
  lag or diverge from it. A mention refers to another resource from this
  script by its `resourceId` in double braces, e.g.
  `<mention-page url="{{getting-started}}">Getting started</mention-page>`.
  External URLs are ordinary Markdown links.
- **Don't use `<mention-database>`.** The server rejects it, which fails the
  whole deploy, although the spec still lists it (finding 20). Name the
  database in plain text instead. The other mention tags are untested since
  then.
- `<page url="{{id}}">` and `<database url="{{id}}">` place an in-script child
  page or database at that spot in the content. They are not mentions: removing
  one removes that child from the page. Use `<mention-page>` for a reference.
- Give every teamspace, page, database and agent an `icon` through the `icon`
  property, never as emoji in its name or title.
- End every build script with `export {}`.
- The DSL's types live in
  `notion-sdk-js/src/EXPERIMENTAL__notion-as-code/utils/types.ts`. Treat them
  as the reference for property, view, filter and content shapes, and don't
  edit the SDK checkout.
- The SDK branch has its own guide at
  `notion-sdk-js/src/EXPERIMENTAL__notion-as-code/AGENTS.md`. Its "Raw Script
  Files" section applies to `builds/*/build.ts`. Its run commands, `scripts/`
  and `sessions/` conventions don't: deploy through `npm run build` here.
- Structure is code, data is UI. If a structural change was made in the
  Notion UI, back-port it into the script, or the next deploy overwrites it.

## Workflow

```bash
npm run build                  # list builds and status
npm run check                  # compile every build, check resourceIds and prefixes (no Notion call)
npm run typecheck              # tsc every build against the DSL types
npm run build -- <name> --dry  # show exactly what a deploy would run
npm run build -- <name>        # deploy / re-deploy (writes to the real workspace)
npm run pull -- --database=<id> --out=builds/<name>/source   # dump an existing database's schema + views
```

- Run `check` and `typecheck` before every deploy. A deploy is one API request
  against a real workspace.
- Don't deploy unless the user asked for it in this conversation. Use `--dry`
  to show what would run.
- Always deploy through `npm run build`, never by calling the SDK runner
  directly. It resolves every path and ID from `build.json` and refuses to run
  if the session file doesn't anchor that build in that workspace.
- After a deploy, commit the updated `session.json`. On a first deploy, also
  set `status`, `deployedAt` and `hubUrl` in `build.json`.
- Never hand-edit `session.json` after the initial seed (see GUARDRAILS for the
  seed format).
- New behaviour of the alpha goes in `docs/FINDINGS.md`. Append new findings
  with the next number and never renumber existing ones, because the numbers
  are cited in feedback to Notion.

## Safety

- Never print, log or commit tokens. `npm run build` reads the token from
  `$NOTION_TOKEN` or the build's 1Password `tokenRef` and passes it only through
  the child process environment. Keep it that way.
- Applies write to the live work.flowers workspace. The guardrails exist
  because there is no throwaway workspace.
