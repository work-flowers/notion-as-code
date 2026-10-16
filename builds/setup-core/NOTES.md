# setup-core — company core databases + team teamspaces

The first build in the dedicated **workFlowers Demo** workspace
(`a426b878-1c06-81cd-8ffa-0003fa91e0c8`). Because that workspace is a demo, this
build may use non-private teamspaces. Every other guardrail still applies.

It tests two things:

1. Can one script create several teamspaces, including an open all-company one?
2. Can a team's teamspace hold a filtered view of a database that lives in the
   all-company teamspace?

## Model

| Teamspace | Access | Contents |
| --- | --- | --- |
| Company | `open` | Home, plus one page per core database (Meeting Notes, Projects, Tasks, Docs), each holding its database inline |
| Operations | `closed` | Home (with the team-only **Vendors** database inline), plus four pages holding linked views of the core databases filtered to Team = Operations |
| Marketing | `closed` | Home, plus four pages holding linked views of the core databases filtered to Team = Marketing |

- Every core database has a **Team** select (Operations, Marketing).
- Relations: Projects ↔ Tasks, Projects ↔ Meeting Notes, Projects ↔ Docs (dual),
  and Meeting Notes → Tasks (`Action Items`, one-way).
- Sample rows: 3 projects, 6 tasks, 3 meeting notes, 3 docs, 3 vendors. Relation
  values are written on the "many" side only (Tasks/Meeting Notes/Docs →
  Project), because of findings 18 and 19.
- No permissions or membership (not expressible, finding 7).
- No auto-increment properties, so no prefixes claimed.

Choices the brief left open:

- **Company is `open`, as asked.** The DSL also offers `default`, which in
  Notion auto-joins every workspace member — the usual meaning of an
  "all-company" teamspace. Switching later is a one-word change, but test it
  before a re-deploy since it changes an existing teamspace.
- **Team teamspaces are `closed`** (visible in the directory, join by invite).
- **Team pages are siblings of Home**, not children; Home links to them with
  `<mention-page>` chips. That's a probe: finding 20 left `<mention-page>`
  untested since the server started rejecting `<mention-database>`. If the
  deploy is rejected for it (atomic, as in finding 17), swap the chips for
  `<page url>` placement or plain bold names.

## Compile results (2026-10-16)

`npm run check`: 56 intents (3 teamspaces, 13 databases, 7 view tabs, 33 pages),
96 resourceIds, unique within the build and across builds. The 13 databases are
5 real ones (Projects, Tasks, Meeting Notes, Docs, Vendors) and 8 views-only
linked databases (4 per team). `npm run typecheck`: clean under `strict`.
`--dry`: session anchor `sc-demo-space` matches the demo workspace.

Token check (read-only `GET /v1/users/me`): a user-owned token on workspace
**workFlowers Demo**, `a426b878-…`, the same shape as the primary token.

## Deploy #1 (2026-10-16)

One run, no errors → [Company Home](https://app.notion.com/p/3fb6b8781c068138ba53c3c707df4e92).
`session.json` holds 69 new resources (3 teams, 46 blocks, 5 data sources, 15
views) and 27 properties, plus the workspace anchor. Checked through the API
afterwards:

| Check | Result |
| --- | --- |
| **Test 1:** several teamspaces from one script, including an open one | ✅ all three created. Access levels aren't readable via the API (pages report `parent: workspace`), so confirm Open / Closed in the UI |
| **Test 2:** team teamspace holds a filtered view of a Company database | ✅ each team page's linked database has a view on the Company data source, filtered to its team. ⚠️ The filter is a removable **quick filter**, not a saved one (finding 21) |
| Filter results | Tasks: 3 Operations, 3 Marketing, which matches the seed |
| Vendors database inside Operations Home | ✅ `parent: page_id` = Operations Home |
| `<mention-page>` chips on both Home pages | ✅ accepted and rendered as page mentions (finding 20 is limited to `<mention-database>`) |
| Sample rows | ✅ 3 projects, 6 tasks, 3 meeting notes, 3 docs, 3 vendors, with selects, statuses and dates as written |
| Meeting Notes → Project, Docs → Project | ✅ read from both sides |
| Tasks → Project | ❌ empty on all 6 tasks, though Projects → Tasks shows 2 / 1 / 3. Finding 19 on a clean first deploy (finding 22) |
| Meeting Notes → Action Items (one-way) | ✅ 2 / 1 / 2 as written |

## Post-deploy manual steps

1. In the UI, confirm Company is Open and Operations / Marketing are Closed.
2. To lock the team views, turn each team view's quick filter into a saved
   filter by hand (finding 21). A re-deploy may put it back as a quick filter,
   and that's untested.
3. Re-link the six tasks to their projects from the Tasks side if the demo
   needs it to read correctly there (finding 22). **Don't re-deploy** to fix
   this: a re-deploy clears every dual-relation value (finding 18).
4. Add members to the teamspaces by hand. Permissions aren't expressible
   (finding 7).
