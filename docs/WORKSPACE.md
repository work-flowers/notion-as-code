# Workspace registry

Deploy targets and the workspace-global namespaces each build has claimed.
Anything listed here is taken; check before adding a build.

## work.flowers primary — `9607e18f-5d82-4842-8b96-ca0d32e66011`

The only workspace the Notion as Code alpha is enabled on (no demo workspace
access), which is why every build is fenced into a private teamspace — see
[GUARDRAILS.md](GUARDRAILS.md).

Auth: **Personal Access Token** (not an integration bot token), attached to this
workspace, stored at `op://Employee/notion-as-code/credential`
(1Password account `work-flowers`).

| Build | Teamspace | Status | Auto-increment prefixes |
| --- | --- | --- | --- |
| `knoxx-rnd` | KI R&D Sandbox (private) | deployed 2026-07-24 | `KIP` `KIA` `KIK` `KIC` |
| `crm` | CRM Sandbox (private) | deployed 2026-07-25 | `CRMC` `CRMD` |

Also in use by **production** databases in this workspace (do not reuse):
`COM` (Companies), `DEAL` (Deals).

`npm run check` enforces that no two builds in the same workspace claim the same
prefix, but it cannot see production databases — those are the manual half of
finding 6.
