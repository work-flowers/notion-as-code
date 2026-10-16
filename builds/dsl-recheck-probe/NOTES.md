# dsl-recheck-probe — does ntn 0.23.20 fix findings 4, 9, 12 and 14?

A one-teamspace probe in the **workFlowers Demo** workspace. It checks the DSL
that `ntn` 0.23.20 ships against four findings from the July SDK (`3d33935`),
plus two features another tester reports working: feed views and
`this_page`-filtered per-record layouts. It's its own build, so its re-deploys
can't clear another build's relation values (finding 18).

It's the first build with `"engine": "ntn"`: it compiles against
`vendor/ntn-template` and deploys through `ntn notion-as-code apply`, still via
`npm run build` (findings 25–26).

**Deployed 2026-10-16** (hub: [About this probe](https://app.notion.com/p/3fb6b8781c0681349eb7ca86ba438138)). It took four runs.
Runs 1–3 were rejected with nothing created:

1. The page-layout tab view sat on the Projects database. It has to be on the
   Tasks database, its own data source's.
2. Child databases weren't placed in the hub's content. Added
   `<database url="{{…}}" inline="true">` tags.
3. The automation was rejected because the Demo workspace isn't on Plus. Dropped
   it and its log database; the shape is kept in a comment in `build.ts`.

## Results

| Piece | Probes | Result |
| --- | --- | --- |
| Hub page `<tabs>` block | finding 14 | ✅ deploys as a `tab` block with two panes |
| Tasks view **Due today** | finding 4, preset | ✅ reads back as a quick filter, `Due equals today` |
| Tasks views **Next 2 weeks**, **Ends this month** | finding 4, `relative_to_today` (+ `dateFilterMode: "end_date"`) | accepted; API reads `null`, so the UI check is pending |
| Tasks view **In progress or overdue** | finding 12, `or` group | ✅ reads back as the saved filter (finding 27) |
| Tasks view **Open, due soon** | finding 12, `and` nesting an `or` with two Due filters | accepted (no finding-17 rejection); the readback is missing the `relative_to_today` member, so the UI check is pending |
| `is_empty` | finding 12 | ❌ no operator in the DSL |
| Tasks view **Feed** | feed views | created; `GET /v1/views` still 400s; UI check pending |
| Probe Projects page layout, **Tasks** tab | `this_page` filter | layout and tab view created; the filter reads `null`; UI check pending |
| Database automation | finding 9 | ❌ needs Plus or higher; the Demo workspace is on Free |
| Buttons | finding 9 | ❌ no DSL surface |

Raw readbacks aren't committed. To re-run them: `GET /v1/views/{id}` for each
`collection_view` in `session.json`.

## UI check (pending)

With the seed dates (deployed 2026-10-16), each view should show:

| View | Should show |
| --- | --- |
| Next 2 weeks | Due 5 days after deploy, Range ending next month (it starts 2026-10-20), and probably Due on deploy day, if "next" counts today |
| Ends this month | the three single-date tasks, since single dates fall back to their start; not the range, which ends 2026-11-10 |
| Open, due soon | Due on deploy day, Due 5 days after deploy. The filter editor should show both Due conditions in the OR group |
| Feed | renders as a feed with author bylines |
| Alpha → Tasks tab | the three Alpha tasks; Beta's shows one |

Record the results in docs/FINDINGS.md (findings 4, 12 and 25) and here.

## Clean-up

Delete these by hand when the probe is no longer needed (the API can't
delete). Deleting the teamspace removes everything inside it:

- Teamspace **DSL Recheck Probe** (Settings → Teamspaces), containing:
  - page **About this probe**
  - databases **Probe Projects** (2 rows: Alpha, Beta) and **Probe Tasks** (4 rows)

Then set `status` to `retired` in `build.json`. Don't re-deploy afterwards: the
session file would point at deleted records.
