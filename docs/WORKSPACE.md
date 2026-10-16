# Workspace registry

Deploy targets and the workspace-global namespaces each build has claimed.
Anything listed here is taken; check before adding a build.

## work.flowers primary — `9607e18f-5d82-4842-8b96-ca0d32e66011`

The first workspace the Notion as Code alpha was enabled on, and still the
real one, which is why every build here is fenced into a private teamspace —
see [GUARDRAILS.md](GUARDRAILS.md).

Auth: **Personal Access Token** (not an integration bot token), attached to this
workspace, stored at `op://Employee/notion-as-code/credential`
(1Password account `work-flowers`).

| Build | Teamspace | Status | Auto-increment prefixes |
| --- | --- | --- | --- |
| `knoxx-rnd` | KI R&D Sandbox (private) | deployed 2026-07-24 | `KIP` `KIA` `KIK` `KIC` |
| `crm` | CRM Sandbox (private) | deployed 2026-07-25 | `CRMC` `CRMD` |

Also in use by **production** databases in this workspace (do not reuse):
`COM` (Companies), `DEAL` (Deals).

## workFlowers Demo — `a426b878-1c06-81cd-8ffa-0003fa91e0c8`

A dedicated demo workspace. Builds here **may use non-private teamspaces**
(open, closed or default); every other guardrail still applies.

Auth: **Personal Access Token**, attached to this workspace, stored at
`op://Employee/notion-as-code-demo/credential` (1Password account
`work-flowers`).

| Build | Teamspaces | Status | Auto-increment prefixes |
| --- | --- | --- | --- |
| `setup-core` | Company (open), Operations (closed), Marketing (closed) | removed 2026-10-16 | — |
| `template-demo` | DemoCo HQ (default), Operations (closed), Marketing (closed) | removed 2026-10-16 | — |
| `democo` | DemoCo HQ (default), Operations (closed), Marketing (closed) | removed 2026-10-16 | — |
| `democo-2` | DemoCo HQ (default), Operations (closed), Marketing (closed) | deployed 2026-10-16 | — |
| `default-teamspace-probe` | Default Probe A (default), Default Probe B (open) | removed 2026-10-16 | — |
| `dsl-recheck-probe` | DSL Recheck Probe (open) | deployed 2026-10-16 | — |

## Prefix checks

`npm run check` enforces that no two builds in the same workspace claim the same
prefix, but it cannot see production databases — those are the manual half of
finding 6.
