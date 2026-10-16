# dsl-recheck-probe — does ntn 0.23.20 fix findings 4, 9, 12 and 14?

A one-teamspace probe in the **workFlowers Demo** workspace. It checks the DSL
that `ntn` 0.23.20 ships against four findings from the July SDK (`3d33935`),
plus two features another tester reports working: feed views and
`this_page`-filtered per-record layouts. It's its own build, so its re-deploys
can't clear another build's relation values (finding 18).

It's the first build with `"engine": "ntn"`: it compiles against
`vendor/ntn-template` and deploys through `ntn notion-as-code apply`, still via
`npm run build` (finding 25).

**Status: not deployed.** `check`, `typecheck` and `--dry` pass (2026-10-16).
The verdicts below are from the types only, until a deploy.

## What each piece probes

| Piece | Probes | Types say | Server |
| --- | --- | --- | --- |
| Tasks views **Due today**, **Next 2 weeks**, **Ends this month** | relative-date filters (finding 4); the last uses `dateFilterMode: "end_date"` | fixed | pending |
| Tasks view **In progress or overdue** | an advanced `or` group (finding 12) | fixed | pending |
| Tasks view **Open, due soon** | an `and` group nesting an `or` that holds two filters on Due, which finding 17's one-filter-per-property rule might reject | fixed | pending |
| *(none)* | `is_empty` (finding 12) | still open: no operator, typecheck rejects it | — |
| Tasks view **Feed** | a feed view, and whether `GET /v1/views/{id}` can read one now (finding 8 caveat) | unchanged | pending |
| **Log new tasks** automation | a database automation: page added to Probe Tasks → create a page in Probe Automation Log (finding 9) | fixed, `create_page` only | pending |
| *(none)* | buttons (finding 9) | still open: no DSL surface | — |
| Probe Projects **page layout** | a **Tasks** view tab filtered to `relation_contains this_page` | new | pending |
| Hub page **`<tabs>` block** | two tabs in page content (finding 14) | fixed | pending |

`Tasks → Project` is one-way, so the `this_page` tab can't be confounded by
findings 19 and 22 (dual relations that land one-sided).

## Expected results after a deploy on 2026-10-16

Seed dates assume the deploy runs on 2026-10-16. Later deploys shift what
each relative view shows.

| View | Should show |
| --- | --- |
| Due today | Due on deploy day |
| Next 2 weeks | Due 5 days after deploy, Range ending next month (it starts 2026-10-20), and probably Due on deploy day, if "next" counts today |
| Ends this month | the three single-date tasks, since single dates fall back to their start; not the range, which ends 2026-11-10 |
| In progress or overdue | Due 5 days after deploy (in progress), Overdue at deploy |
| Open, due soon | Due on deploy day, Due 5 days after deploy |
| Alpha's Tasks tab | the three Alpha tasks; Beta's shows one |

Also check that Probe Automation Log gets an entry whenever a task is added in
the UI, and whether the four seeded tasks created entries too.

## Risks

- **Plan:** database automations need Plus or higher. If the Demo workspace
  is on Free, the run should fail before creating anything (rejections are
  atomic, finding 17). Then drop the automation, re-run and record the
  error.
- **Rejected filters:** if finding 17's rule rejects **Open, due soon**, the
  whole run fails the same way. Record the error, split the view and re-run.
- **ntn apply:** this is the first deploy through `ntn`. It may prompt for
  confirmation in a non-TTY shell, as the SDK runner did (finding 3), and it
  writes metadata (`lastAppliedAtMs`, `lastScript`, `createdRecordCounts`)
  into `session.json`. Commit that file as usual.

## After a deploy

1. Read every view back with `GET /v1/views/{id}`, checking both `filter` and
   `quick_filters` (finding 21), and note whether the feed view reads.
2. In the UI, check the hub's tabs, a project's Tasks tab and the
   automation's settings.
3. Mark findings 4, 9, 12 and 14 confirmed-fixed or still-open in
   docs/FINDINGS.md, and fill in the Server column above.
4. Set `status`, `deployedAt` and `hubUrl` in `build.json`.

Everything here is safe to delete.
