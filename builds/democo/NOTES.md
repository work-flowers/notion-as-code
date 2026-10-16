# democo — the core template, fresh deploy with page layouts

The test build of the workFlowers core template (TKT-978) in the **workFlowers
Demo** workspace (`a426b878-1c06-81cd-8ffa-0003fa91e0c8`). It replaces
`template-demo`, whose teamspaces Dennis deleted first: page layouts need a
re-deploy, and that build had rows.

Generated with:

```bash
npm run new-build -- democo --prefix dc --spec builds/template-demo/spec.ts
```

`spec.ts` is template-demo's spec (DemoCo HQ, Operations, Marketing, with
sample records), renamed. Engine: `ntn`.

## Deploy #1 (2026-10-16)

One run, no errors → [DemoCo HQ Home](https://app.notion.com/p/3fb6b8781c068176874aed4fd2be6815).
Created 3 teamspaces, 13 databases and 32 pages.

Checked through the API and in the app (Dennis signed the in-app browser in):

| Check | Result |
| --- | --- |
| Rows and relations | ✅ 3 / 6 / 3 / 3 / 2 rows. Every two-way relation pairs, including the new Tasks → **Meeting** back-link of Action Items |
| Company and team tabs | ✅ as in template-demo, with saved team filters |
| Page layouts | ✅ pins under the title, Summary as its own block in the project's Overview tab, a Details side pane. Project relations sit under "3 more properties" (hidden) |
| Related tabs (`this_page`) | ✅ checked on several records: Website refresh shows its 2 tasks, 1 meeting and 2 docs; Quarterly planning its own 2 tasks and no docs; the kick-off meeting's Action Items its 2 tasks; the all-hands' Action Items none. The filters read back `null` through the API, so the app is the only check |
| Related tab columns | ⚠️ show every property, not just the listed ones: a table keeps unlisted properties visible. The template now lists the rest as hidden |
| Board columns | ❌ reversed on a fresh deploy: Cancelled, Done, In progress, Not started. The DSL has no column sort |
| Timeline | ✅ opens on today with rows, sorted by Dates |

## Still to do on this build (API or UI)

1. Set the six Projects / Tasks boards' column sort to ascending.
2. Hide the extra columns on the four related tabs.
3. Pin Team on all four layouts and Project on Tasks (template change made
   after this deploy).

This build has rows, so don't re-deploy it (finding 18).

## Deploy #2 (2026-10-16): re-deploy test

Fixed through the API first: the six boards' column sort (ascending) and the
related tabs' extra columns. Then regenerated with the new pins (Team on every
layout, Project on Tasks) using `--force --allow-rows`, and re-deployed to
test finding 18 on `ntn`. One run, no errors, nothing created, layouts
updated (the task page now pins Project). But both Meeting Notes relations
were cleared on every meeting, along with the Tasks → Meeting back-links
(finding 33). Tasks, Docs and Vendors kept theirs.

So this build's sample data is now incomplete, and it gets replaced by a
fresh deploy.
