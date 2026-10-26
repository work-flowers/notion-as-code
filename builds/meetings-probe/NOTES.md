# meetings-probe — attendee-only Meeting Notes layout (TKT-1032)

A probe in the **workFlowers Demo** workspace for the attendee-only Meeting
Notes model in the permissions guide. Members get No access to the Meeting
Notes source database and see meetings only through linked views, so the
build has to put the source database on an admin-only page and the
everyday Meeting Notes page elsewhere, made only of linked views.

| Piece | Probes |
| --- | --- |
| **Meetings Probe Admin** teamspace (private), page **Meeting Notes (source)** | the source database on an admin-only page |
| **Probe Meeting Notes** database: Attendees, **Shared with** (person), Created by, Project | the Shared with property next to the attendee properties |
| **Meetings Probe** teamspace (open), page **Meeting Notes** | a views-only linked database of the admin-only source: My meetings, Recent, Calendar |
| **Probe Projects** page layout, **Meeting Notes** tab | a view of the admin-only source, filtered to `this_page` |

The DSL has no database type (finding 34), so the source is an ordinary
database, not the meetings type.

**Not deployed yet.** Five applies on 2026-10-26 failed with
`503 service_unavailable` ("Async Public API operation could not be
queued"), and so did an unchanged re-apply of `dsl-recheck-probe`, so it was
a Notion outage (finding 35). Nothing was created. Deploy with
`npm run build -- meetings-probe` (add `--verbose` for ntn's full error)
once the queue recovers, then record the results here and in finding 35.

## After the deploy

- Read back each view in `session.json` (`GET /v1/views/{id}`). The `me`
  and relative-date filters will read `null` (findings 25, 30), so check My
  meetings and Recent in the UI.
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
