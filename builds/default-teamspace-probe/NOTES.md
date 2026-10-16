# default-teamspace-probe — can a script make a teamspace a workspace default?

A two-teamspace probe in the **workFlowers Demo** workspace. It's kept apart
from `setup-core` so that its re-deploys can't clear setup-core's relation
values (finding 18).

**Answer: yes.** A script can create the all-company teamspace as a workspace
**Default**, even though the workspace already has the default teamspace
Notion pre-installs. The workspace then has two default teamspaces. The script
can't remove the pre-installed one, but an admin can delete it by hand if it's
empty (finding 23).

The one catch: access level only applies on create. Changing an existing
teamspace to `default` on a re-deploy is silently ignored (finding 24), so set
`default` on the teamspace's first deploy.

| Teamspace | Run 1 | Run 2 |
| --- | --- | --- |
| Default Probe A | created `default` | unchanged |
| Default Probe B | created `open` | flipped to `default` |

Each teamspace holds one "About this probe" page. Both are safe to delete.

## The pre-installed default teamspace

Scripts can only reference resources they created, so no script can find the
workspace's pre-installed default teamspace, change it or delete it, and there's
no workspace-settings intent. Notion allows several default teamspaces at once,
so `default` adds a second default alongside it. If the pre-installed one is
empty, delete it by hand in Settings → Teamspaces.

## Results (2026-10-16)

- **Run 1:** accepted. `accessLevel: "default"` passes server validation on
  create.
- **Run 2:** accepted. The 4 resource mappings are unchanged, so no duplicate
  teamspace was created.
- **In the UI** (Settings → Teamspaces, checked by Dennis): Probe A shows
  **Default**, Probe B still shows **Open**.

So `default` works on create (finding 23), but **a re-deploy silently ignores
an access-level change on an existing teamspace** (finding 24). The run succeeds
and reports nothing.

**Drift:** `build.ts` now says Probe B is `default`, but the live teamspace is
Open. Script and workspace disagree, and re-deploying won't fix it.

## What this means for setup-core

Changing Company from `open` to `default` in `setup-core/build.ts` and
re-deploying wouldn't work (finding 24). It would also clear setup-core's relation values
(finding 18). To make Company a default, either change it by hand in Settings →
Teamspaces and set `default` in the script to match, or create it as `default`
on a build's first deploy. Either way, delete the workspace's pre-installed
default teamspace by hand if it's empty.
