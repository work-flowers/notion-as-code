/**
 * dsl-recheck-probe — does the current Notion as Code release fix findings 4,
 * 9, 12 and 14?
 *
 * Demo workspace only (non-private teamspaces allowed there; see
 * docs/GUARDRAILS.md). Its own build, so its re-deploys can't clear another
 * build's relation values (finding 18).
 *
 * Uses the "ntn" engine (build.json): the DSL in vendor/ntn-template, from the
 * template `ntn` 0.23.20 ships. The notion-sdk-js branch hasn't moved since
 * 3d33935 (2026-07-23), and its runtime has no `addAutomation`.
 *
 * What each piece probes:
 *   - Tasks views "Due today", "Next 2 weeks", "Ends this month":
 *     relative-date filters (finding 4).
 *   - Tasks views "In progress or overdue", "Open, due soon": advanced and/or
 *     filter groups (finding 12). The second nests two filters on Due inside
 *     an OR, which finding 17's one-filter-per-property rule might reject.
 *     `is_empty` has no operator in the types, so it isn't probed.
 *   - Tasks view "Feed": a feed view, and whether GET /v1/views can read it
 *     back now (finding 8 caveat).
 *   - "Log new tasks" automation: a database automation (finding 9). Buttons
 *     have no DSL surface, so they aren't probed.
 *   - Projects page layout: a view tab filtered to `this_page`, so each
 *     project page lists its own tasks (per-record layouts).
 *   - The hub page's <tabs> block (finding 14).
 *
 * Tasks → Project is one-way, so the this_page tab can't be confounded by the
 * one-sided dual relations of findings 19 and 22.
 */

const spaceParent = {
  type: "resourceId",
  resourceId: "drp-demo-space",
} as const

const teamspace = notion.teamspace({
  resourceId: "drp-teamspace",
  parent: spaceParent,
  name: "DSL Recheck Probe",
  accessLevel: "open",
  icon: { type: "notion_icon", description: "flask", color: "purple" },
  description: "Notion as Code probe: does ntn 0.23.20 fix findings 4, 9, 12 and 14?",
})

const hub = teamspace.addPage({
  resourceId: "drp-hub",
  icon: { type: "notion_icon", description: "flask", color: "purple" },
  properties: { title: notion.text("About this probe") },
  content: `Created by the **dsl-recheck-probe** build. Safe to delete.

<tabs>
<tab icon="📋">Overview

Each view and layout here tests one feature the July SDK couldn't express. The results are in the repo's \`docs/FINDINGS.md\`.
</tab>
<tab icon="🧪">What to check

- **Probe Tasks:** the relative-date and and/or views, the Feed view, and the "Log new tasks" automation.
- **Probe Projects:** open a project. Its **Tasks** tab should list only that project's tasks.
- **This page:** this block should render as two tabs (finding 14).
</tab>
</tabs>
`,
})

// ---------------------------------------------------------------------------
// Databases
// ---------------------------------------------------------------------------

const projectsDb = notion.database({
  resourceId: "drp-projects-db",
  parent: { type: "resourceId", resourceId: hub.resourceId },
  name: "Probe Projects",
  icon: { type: "notion_icon", description: "rocket", color: "purple" },
  dataSources: [
    {
      resourceId: "drp-projects-ds",
      name: "Probe Projects",
      properties: [
        { resourceId: "drp-pj-name", name: "Name", type: "title" },
        { resourceId: "drp-pj-summary", name: "Summary", type: "text" },
      ],
      pageLayout: {
        main: [{ type: "properties" }],
        tabs: [
          { type: "content", name: "Overview" },
          { type: "view", resourceId: "drp-project-tasks-tab-view" },
        ],
      },
    },
  ],
})

const tasksDb = notion.database({
  resourceId: "drp-tasks-db",
  parent: { type: "resourceId", resourceId: hub.resourceId },
  name: "Probe Tasks",
  icon: { type: "notion_icon", description: "checkmark square", color: "purple" },
  dataSources: [
    {
      resourceId: "drp-tasks-ds",
      name: "Probe Tasks",
      properties: [
        { resourceId: "drp-tk-name", name: "Name", type: "title" },
        {
          resourceId: "drp-tk-status",
          name: "Status",
          type: "status",
          options: {
            todo: [{ name: "Not started", color: "gray", default: true }],
            inProgress: [{ name: "In progress", color: "blue" }],
            complete: [{ name: "Done", color: "green" }],
          },
        },
        { resourceId: "drp-tk-due", name: "Due", type: "date" },
        // One-way, so no back-link on Projects (see the header comment).
        {
          resourceId: "drp-tk-project-rel",
          name: "Project",
          type: "relation",
          targetDataSourceResourceId: "drp-projects-ds",
        },
      ],
    },
  ],
})

const logDb = notion.database({
  resourceId: "drp-log-db",
  parent: { type: "resourceId", resourceId: hub.resourceId },
  name: "Probe Automation Log",
  icon: { type: "notion_icon", description: "list", color: "purple" },
  dataSources: [
    {
      resourceId: "drp-log-ds",
      name: "Probe Automation Log",
      properties: [{ resourceId: "drp-lg-name", name: "Name", type: "title" }],
    },
  ],
})

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

projectsDb.addView({
  resourceId: "drp-projects-all-view",
  name: "All projects",
  type: "table",
  dataSourceResourceId: "drp-projects-ds",
})

// The page-layout tab: Tasks rows whose Project is the page being viewed.
projectsDb.addView({
  resourceId: "drp-project-tasks-tab-view",
  name: "Tasks",
  icon: { type: "notion_icon", description: "checkmark square" },
  type: "table",
  dataSourceResourceId: "drp-tasks-ds",
  ephemeral: true,
  filters: [
    {
      type: "property",
      propertyId: "drp-tk-project-rel",
      propertyType: "relation",
      operator: "relation_contains",
      value: { type: "relative", value: "this_page" },
    },
  ],
})

tasksDb.addView({
  resourceId: "drp-tasks-all-view",
  name: "All tasks",
  type: "table",
  dataSourceResourceId: "drp-tasks-ds",
  sorts: [{ propertyId: "drp-tk-due", direction: "ascending" }],
})

// Finding 4: relative-date filters.
tasksDb.addView({
  resourceId: "drp-tasks-today-view",
  name: "Due today",
  type: "table",
  dataSourceResourceId: "drp-tasks-ds",
  filters: [
    {
      type: "property",
      propertyId: "drp-tk-due",
      propertyType: "date",
      operator: "date_is",
      value: { type: "relative", value: "today" },
    },
  ],
})
tasksDb.addView({
  resourceId: "drp-tasks-next-2w-view",
  name: "Next 2 weeks",
  type: "table",
  dataSourceResourceId: "drp-tasks-ds",
  filters: [
    {
      type: "property",
      propertyId: "drp-tk-due",
      propertyType: "date",
      operator: "date_is_relative_to",
      value: { type: "relative_to_today", value: { direction: "next", count: 2, unit: "week" } },
    },
  ],
})
tasksDb.addView({
  resourceId: "drp-tasks-ends-this-month-view",
  name: "Ends this month",
  type: "table",
  dataSourceResourceId: "drp-tasks-ds",
  filters: [
    {
      type: "property",
      propertyId: "drp-tk-due",
      propertyType: "date",
      operator: "date_is_relative_to",
      value: { type: "relative_to_today", value: { direction: "this", unit: "month" } },
      dateFilterMode: "end_date",
    },
  ],
})

// Finding 12: advanced and/or groups.
tasksDb.addView({
  resourceId: "drp-tasks-or-view",
  name: "In progress or overdue",
  type: "table",
  dataSourceResourceId: "drp-tasks-ds",
  filters: [
    {
      type: "advanced",
      operator: "or",
      filters: [
        {
          type: "property",
          propertyId: "drp-tk-status",
          propertyType: "status",
          operator: "status_is",
          value: ["In progress"],
        },
        {
          type: "property",
          propertyId: "drp-tk-due",
          propertyType: "date",
          operator: "date_is_before",
          value: { type: "relative", value: "today" },
        },
      ],
    },
  ],
})
tasksDb.addView({
  resourceId: "drp-tasks-and-nested-view",
  name: "Open, due soon",
  type: "table",
  dataSourceResourceId: "drp-tasks-ds",
  filters: [
    {
      type: "advanced",
      operator: "and",
      filters: [
        {
          type: "property",
          propertyId: "drp-tk-status",
          propertyType: "status",
          operator: "status_is_not",
          value: ["Done"],
        },
        {
          type: "advanced",
          operator: "or",
          filters: [
            {
              type: "property",
              propertyId: "drp-tk-due",
              propertyType: "date",
              operator: "date_is",
              value: { type: "relative", value: "today" },
            },
            {
              type: "property",
              propertyId: "drp-tk-due",
              propertyType: "date",
              operator: "date_is_relative_to",
              value: { type: "relative_to_today", value: { direction: "next", count: 1, unit: "week" } },
            },
          ],
        },
      ],
    },
  ],
})

// Feed view (finding 8 caveat: can GET /v1/views read it back now?).
tasksDb.addView({
  resourceId: "drp-tasks-feed-view",
  name: "Feed",
  type: "feed",
  dataSourceResourceId: "drp-tasks-ds",
  showAuthorByline: true,
})

logDb.addView({
  resourceId: "drp-log-all-view",
  name: "All entries",
  type: "table",
  dataSourceResourceId: "drp-log-ds",
})

// ---------------------------------------------------------------------------
// Finding 9: a database automation. Plus plan or higher.
// ---------------------------------------------------------------------------

tasksDb.dataSources["drp-tasks-ds"].addAutomation({
  resourceId: "drp-log-new-tasks-automation",
  name: "Log new tasks",
  triggers: [{ type: "page_added" }],
  actions: [
    {
      resourceId: "drp-log-new-tasks-action",
      type: "create_page",
      dataSourceResourceId: "drp-log-ds",
    },
  ],
})

// ---------------------------------------------------------------------------
// Seed rows. Dates are relative to the first deploy (planned 2026-10-16).
// ---------------------------------------------------------------------------

const projects = projectsDb.dataSources["drp-projects-ds"]
projects.addPage({
  resourceId: "drp-project-alpha",
  icon: { type: "notion_icon", description: "rocket", color: "blue" },
  properties: { Name: notion.text("Alpha"), Summary: notion.text("Owns three tasks.") },
})
projects.addPage({
  resourceId: "drp-project-beta",
  icon: { type: "notion_icon", description: "rocket", color: "orange" },
  properties: { Name: notion.text("Beta"), Summary: notion.text("Owns one task.") },
})

const tasks = tasksDb.dataSources["drp-tasks-ds"]
tasks.addPage({
  resourceId: "drp-task-due-today",
  properties: {
    Name: notion.text("Due on deploy day"),
    Status: notion.status("Not started"),
    Due: notion.date("2026-10-16"),
    Project: notion.relation(["drp-project-alpha"]),
  },
})
tasks.addPage({
  resourceId: "drp-task-due-next-week",
  properties: {
    Name: notion.text("Due 5 days after deploy"),
    Status: notion.status("In progress"),
    Due: notion.date("2026-10-21"),
    Project: notion.relation(["drp-project-alpha"]),
  },
})
tasks.addPage({
  resourceId: "drp-task-overdue",
  properties: {
    Name: notion.text("Overdue at deploy"),
    Status: notion.status("Not started"),
    Due: notion.date("2026-10-09"),
    Project: notion.relation(["drp-project-alpha"]),
  },
})
tasks.addPage({
  resourceId: "drp-task-range-into-next-month",
  properties: {
    Name: notion.text("Range ending next month"),
    Status: notion.status("Done"),
    Due: notion.date("2026-10-20", "2026-11-10"),
    Project: notion.relation(["drp-project-beta"]),
  },
})

export {}
