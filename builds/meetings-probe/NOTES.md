# meetings-probe — attendee-only Meeting Notes layout (TKT-1032)

A probe in the **workFlowers Demo** workspace for the attendee-only Meeting
Notes model in the permissions guide. Members get No access to the Meeting
Notes source database and see meetings only through linked views, so the
build has to put the source database on an admin-only page and the
everyday Meeting Notes page elsewhere, made only of linked views.

| Piece | Probes |
| --- | --- |
| **Meetings Probe Admin** teamspace (closed), page **Meeting Notes (source)** | the source database on an admin-only page |
| **Probe Meeting Notes** database: Attendees, **Shared with** (person), Created by, Project | the Shared with property next to the attendee properties |
| **Meetings Probe** teamspace (open), page **Meeting Notes** | a views-only linked database of the admin-only source: My meetings, Recent, Calendar |
| **Probe Projects** page layout, **Meeting Notes** tab | a view of the admin-only source, filtered to `this_page` |

The DSL has no database type (finding 34), so the source is an ordinary
database, not the meetings type.

**Deployed 2026-10-27** (hub: [About this probe](https://app.notion.com/p/4066b8781c06810f9922e235a8eda999)).
Seven applies on 2026-10-26 failed with `503 service_unavailable` ("Async
Public API operation could not be queued"), a Notion outage (finding 35).
On 2026-10-27 the first run was rejected because the Demo workspace's plan
doesn't allow private teamspaces, so the admin teamspace is closed. The
second run created 2 teamspaces, 8 pages and 3 databases.

## Results

Read back through the public API on 2026-10-27:

| Piece | Result |
| --- | --- |
| Probe Meeting Notes schema | ✅ Name, Date, Attendees (`people`), **Shared with** (`people`), Created by, Project (two-way) |
| Meeting Notes page | ✅ one views-only linked database; My meetings, Recent and Calendar all on the source data source in the closed teamspace |
| Projects page layout, Meeting Notes tab | ✅ created, on the source data source |
| Relations | ✅ Alpha has 2 meetings, Beta 1, on both sides |
| My meetings (`me` OR group), Recent (past 30 days), Meeting Notes tab (`this_page`) | filters read `null`; UI check below |

## UI check (pending)

- My meetings should show all three meetings (Created by is the token owner).
- Open Alpha in Probe Projects: its Meeting Notes tab should show the two
  Alpha meetings; Beta's shows one.
- Recent should show the two Alpha meetings, not the September Beta one.

## Manual checks (UI, not scriptable)

From TKT-1032, in the Demo workspace:

- Convert Probe Meeting Notes to the meetings type, if the UI allows it, and
  note what happens to its properties, views, the Project relation and the
  linked views.
- Meeting Notes general access No access with Can create pages; page-level
  access rules on Shared with (Can view) and Created by (Can edit); the
  auto-share setting for internal participants.
- As a non-admin test user: the source page should error, the linked views
  should show only their meetings and let them create one, and the Project
  tab should behave the same.

## Clean-up

Delete teamspaces **Meetings Probe** and **Meetings Probe Admin** by hand
(Settings → Teamspaces) when done. The API can't delete.
