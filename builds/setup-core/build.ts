/**
 * setup-core — company-wide core databases + team teamspaces (Notion as Code)
 *
 * Deploys to the dedicated **workFlowers Demo** workspace, not the primary
 * work.flowers workspace, so it is the one build allowed to use non-private
 * teamspaces (see docs/GUARDRAILS.md). Every other guardrail still applies:
 * additive only, nothing references an existing Notion ID, and the only mapped
 * existing resource is the workspace itself ("sc-demo-space").
 *
 * What it tests:
 *   1. One script creating several teamspaces, including an open, all-company
 *      one (`accessLevel: "open"`).
 *   2. A team's teamspace holding a filtered, views-only linked database whose
 *      data source lives in the all-company teamspace.
 *
 * Model:
 *   Company (open)
 *     Home
 *     Meeting Notes · Projects · Tasks · Docs — one page per core database,
 *       each holding its database inline. Every database has a Team select
 *       (Operations / Marketing).
 *     Relations: Projects ↔ Tasks, Projects ↔ Meeting Notes, Projects ↔ Docs,
 *       Meeting Notes → Tasks (one-way).
 *   Operations / Marketing (closed)
 *     Home
 *     Meeting Notes · Projects · Tasks · Docs — linked views of the company
 *       databases, filtered to Team = that team.
 *   Operations Home also holds a team-only database (Vendors).
 *
 * Out of scope: permissions and membership (finding 7 — not expressible).
 *
 * Relation values are written on one side only (the "many" side: Tasks →
 * Project, Meeting Notes → Project, Docs → Project), because a re-deploy clears
 * dual-relation values (finding 18) and two-sided writes can land one-sided
 * (finding 19).
 */

const spaceParent = {
  type: "resourceId",
  resourceId: "sc-demo-space",
} as const

const TEAMS = ["Operations", "Marketing"] as const
type Team = (typeof TEAMS)[number]

const teamOptions = [
  { name: "Operations", color: "blue" as const },
  { name: "Marketing", color: "pink" as const },
]

// ---------------------------------------------------------------------------
// Teamspaces
// ---------------------------------------------------------------------------

// "open": anyone in the workspace can see and join it. ("default" would also
// auto-join every member; the brief asked for open.)
const companyTeamspace = notion.teamspace({
  resourceId: "sc-company-teamspace",
  parent: spaceParent,
  name: "Company",
  accessLevel: "open",
  icon: { type: "notion_icon", description: "building", color: "gray" },
  description: "Company-wide home and the core databases every team works from.",
})

const teamTeamspaces: Record<Team, ReturnType<typeof notion.teamspace>> = {
  Operations: notion.teamspace({
    resourceId: "sc-ops-teamspace",
    parent: spaceParent,
    name: "Operations",
    accessLevel: "closed",
    icon: { type: "notion_icon", description: "gear", color: "blue" },
    description: "Operations team home. Views of the company databases, filtered to Operations.",
  }),
  Marketing: notion.teamspace({
    resourceId: "sc-mkt-teamspace",
    parent: spaceParent,
    name: "Marketing",
    accessLevel: "closed",
    icon: { type: "notion_icon", description: "megaphone", color: "pink" },
    description: "Marketing team home. Views of the company databases, filtered to Marketing.",
  }),
}

// ---------------------------------------------------------------------------
// Company teamspace: Home + one page per core database
// ---------------------------------------------------------------------------

companyTeamspace.addPage({
  resourceId: "sc-company-home",
  icon: { type: "notion_icon", description: "home", color: "gray" },
  properties: { title: notion.text("Home") },
  content: `<callout icon="🏢" color="gray_bg">
	**Company home.** The four core databases live here and are shared by every team. Each row carries a **Team** tag; the Operations and Marketing teamspaces show the same rows filtered to their own team.
</callout>

# Core databases

- <mention-page url="{{sc-projects-page}}">Projects</mention-page> — what we're delivering
- <mention-page url="{{sc-tasks-page}}">Tasks</mention-page> — the work inside each project
- <mention-page url="{{sc-meetings-page}}">Meeting Notes</mention-page> — decisions and action items
- <mention-page url="{{sc-docs-page}}">Docs</mention-page> — guides, policies and specs
`,
})

const projectsPage = companyTeamspace.addPage({
  resourceId: "sc-projects-page",
  icon: { type: "notion_icon", description: "rocket", color: "gray" },
  properties: { title: notion.text("Projects") },
  fullWidth: true,
  content: `<database url="{{sc-projects-db}}" inline="true">Projects</database>
`,
})

const tasksPage = companyTeamspace.addPage({
  resourceId: "sc-tasks-page",
  icon: { type: "notion_icon", description: "checkmark square", color: "gray" },
  properties: { title: notion.text("Tasks") },
  fullWidth: true,
  content: `<database url="{{sc-tasks-db}}" inline="true">Tasks</database>
`,
})

const meetingsPage = companyTeamspace.addPage({
  resourceId: "sc-meetings-page",
  icon: { type: "notion_icon", description: "calendar", color: "gray" },
  properties: { title: notion.text("Meeting Notes") },
  fullWidth: true,
  content: `<database url="{{sc-meetings-db}}" inline="true">Meeting Notes</database>
`,
})

const docsPage = companyTeamspace.addPage({
  resourceId: "sc-docs-page",
  icon: { type: "notion_icon", description: "document", color: "gray" },
  properties: { title: notion.text("Docs") },
  fullWidth: true,
  content: `<database url="{{sc-docs-db}}" inline="true">Docs</database>
`,
})

// ---------------------------------------------------------------------------
// Core databases
// ---------------------------------------------------------------------------

const projectsDb = notion.database({
  resourceId: "sc-projects-db",
  parent: { type: "resourceId", resourceId: projectsPage.resourceId },
  name: "Projects",
  icon: { type: "notion_icon", description: "rocket", color: "gray" },
  description: "Company-wide projects, tagged by team.",
  dataSources: [
    {
      resourceId: "sc-projects-ds",
      name: "Projects",
      properties: [
        { resourceId: "sc-pj-name", name: "Name", type: "title" },
        {
          resourceId: "sc-pj-status",
          name: "Status",
          type: "status",
          options: {
            todo: [{ name: "Planned", color: "gray", default: true }],
            inProgress: [{ name: "Active", color: "blue" }],
            complete: [{ name: "Done", color: "green" }],
          },
        },
        { resourceId: "sc-pj-team", name: "Team", type: "select", options: teamOptions },
        { resourceId: "sc-pj-dates", name: "Dates", type: "date" },
        { resourceId: "sc-pj-summary", name: "Summary", type: "text" },
        {
          resourceId: "sc-pj-tasks-rel",
          name: "Tasks",
          type: "relation",
          targetDataSourceResourceId: "sc-tasks-ds",
          targetDataSourcePropertyResourceId: "sc-tk-project-rel",
        },
        {
          resourceId: "sc-pj-meetings-rel",
          name: "Meeting Notes",
          type: "relation",
          targetDataSourceResourceId: "sc-meetings-ds",
          targetDataSourcePropertyResourceId: "sc-mt-project-rel",
        },
        {
          resourceId: "sc-pj-docs-rel",
          name: "Docs",
          type: "relation",
          targetDataSourceResourceId: "sc-docs-ds",
          targetDataSourcePropertyResourceId: "sc-dc-project-rel",
        },
      ],
    },
  ],
})

const tasksDb = notion.database({
  resourceId: "sc-tasks-db",
  parent: { type: "resourceId", resourceId: tasksPage.resourceId },
  name: "Tasks",
  icon: { type: "notion_icon", description: "checkmark square", color: "gray" },
  description: "Company-wide tasks, tagged by team.",
  dataSources: [
    {
      resourceId: "sc-tasks-ds",
      name: "Tasks",
      properties: [
        { resourceId: "sc-tk-name", name: "Name", type: "title" },
        {
          resourceId: "sc-tk-status",
          name: "Status",
          type: "status",
          options: {
            todo: [{ name: "Not started", color: "gray", default: true }],
            inProgress: [{ name: "In progress", color: "blue" }],
            complete: [{ name: "Done", color: "green" }],
          },
        },
        { resourceId: "sc-tk-team", name: "Team", type: "select", options: teamOptions },
        { resourceId: "sc-tk-due", name: "Due", type: "date" },
        {
          resourceId: "sc-tk-project-rel",
          name: "Project",
          type: "relation",
          targetDataSourceResourceId: "sc-projects-ds",
          targetDataSourcePropertyResourceId: "sc-pj-tasks-rel",
          limit: 1,
        },
      ],
    },
  ],
})

const meetingsDb = notion.database({
  resourceId: "sc-meetings-db",
  parent: { type: "resourceId", resourceId: meetingsPage.resourceId },
  name: "Meeting Notes",
  icon: { type: "notion_icon", description: "calendar", color: "gray" },
  description: "Company-wide meeting notes, tagged by team.",
  dataSources: [
    {
      resourceId: "sc-meetings-ds",
      name: "Meeting Notes",
      properties: [
        { resourceId: "sc-mt-name", name: "Name", type: "title" },
        { resourceId: "sc-mt-date", name: "Date", type: "date" },
        { resourceId: "sc-mt-team", name: "Team", type: "select", options: teamOptions },
        {
          resourceId: "sc-mt-type",
          name: "Type",
          type: "select",
          options: [
            { name: "Standup", color: "gray" },
            { name: "Planning", color: "purple" },
            { name: "Review", color: "orange" },
          ],
        },
        {
          resourceId: "sc-mt-project-rel",
          name: "Project",
          type: "relation",
          targetDataSourceResourceId: "sc-projects-ds",
          targetDataSourcePropertyResourceId: "sc-pj-meetings-rel",
          limit: 1,
        },
        // One-way: Tasks gets no back-link property.
        {
          resourceId: "sc-mt-tasks-rel",
          name: "Action Items",
          type: "relation",
          targetDataSourceResourceId: "sc-tasks-ds",
        },
      ],
    },
  ],
})

const docsDb = notion.database({
  resourceId: "sc-docs-db",
  parent: { type: "resourceId", resourceId: docsPage.resourceId },
  name: "Docs",
  icon: { type: "notion_icon", description: "document", color: "gray" },
  description: "Company-wide docs, tagged by team.",
  dataSources: [
    {
      resourceId: "sc-docs-ds",
      name: "Docs",
      properties: [
        { resourceId: "sc-dc-name", name: "Name", type: "title" },
        { resourceId: "sc-dc-team", name: "Team", type: "select", options: teamOptions },
        {
          resourceId: "sc-dc-type",
          name: "Type",
          type: "select",
          options: [
            { name: "Guide", color: "green" },
            { name: "Policy", color: "red" },
            { name: "Spec", color: "purple" },
          ],
        },
        {
          resourceId: "sc-dc-project-rel",
          name: "Project",
          type: "relation",
          targetDataSourceResourceId: "sc-projects-ds",
          targetDataSourcePropertyResourceId: "sc-pj-docs-rel",
          limit: 1,
        },
      ],
    },
  ],
})

// Each core database's own tabs.
projectsDb.addView({
  resourceId: "sc-projects-all-view",
  name: "All projects",
  type: "table",
  dataSourceResourceId: "sc-projects-ds",
  sorts: [{ propertyId: "sc-pj-name", direction: "ascending" }],
})
projectsDb.addView({
  resourceId: "sc-projects-by-team-view",
  name: "By team",
  type: "board",
  dataSourceResourceId: "sc-projects-ds",
  groupBy: { property: "sc-pj-team", type: "select" },
})

tasksDb.addView({
  resourceId: "sc-tasks-all-view",
  name: "All tasks",
  type: "table",
  dataSourceResourceId: "sc-tasks-ds",
  sorts: [{ propertyId: "sc-tk-due", direction: "ascending" }],
})
tasksDb.addView({
  resourceId: "sc-tasks-board-view",
  name: "Board",
  type: "board",
  dataSourceResourceId: "sc-tasks-ds",
  groupBy: { property: "sc-tk-status", type: "status" },
})

meetingsDb.addView({
  resourceId: "sc-meetings-all-view",
  name: "All meetings",
  type: "table",
  dataSourceResourceId: "sc-meetings-ds",
  sorts: [{ propertyId: "sc-mt-date", direction: "descending" }],
})

docsDb.addView({
  resourceId: "sc-docs-all-view",
  name: "All docs",
  type: "table",
  dataSourceResourceId: "sc-docs-ds",
  sorts: [{ propertyId: "sc-dc-name", direction: "ascending" }],
})

// ---------------------------------------------------------------------------
// Team teamspaces: Home + four pages of filtered linked views
// ---------------------------------------------------------------------------

const teamSlug: Record<Team, string> = { Operations: "ops", Marketing: "mkt" }

/** The four core databases, as seen from a team teamspace. */
const teamViews = [
  {
    key: "projects",
    title: "Projects",
    icon: "rocket",
    dataSource: "sc-projects-ds",
    teamProp: "sc-pj-team",
    type: "table" as const,
    sorts: [{ propertyId: "sc-pj-name", direction: "ascending" as const }],
  },
  {
    key: "tasks",
    title: "Tasks",
    icon: "checkmark square",
    dataSource: "sc-tasks-ds",
    teamProp: "sc-tk-team",
    type: "table" as const,
    sorts: [{ propertyId: "sc-tk-due", direction: "ascending" as const }],
  },
  {
    key: "meetings",
    title: "Meeting Notes",
    icon: "calendar",
    dataSource: "sc-meetings-ds",
    teamProp: "sc-mt-team",
    type: "table" as const,
    sorts: [{ propertyId: "sc-mt-date", direction: "descending" as const }],
  },
  {
    key: "docs",
    title: "Docs",
    icon: "document",
    dataSource: "sc-docs-ds",
    teamProp: "sc-dc-team",
    type: "table" as const,
    sorts: [{ propertyId: "sc-dc-name", direction: "ascending" as const }],
  },
]

for (const team of TEAMS) {
  const slug = teamSlug[team]
  const teamspace = teamTeamspaces[team]
  const color = team === "Operations" ? "blue" : "pink"

  const homeExtra =
    team === "Operations"
      ? `
# Team-only database

<database url="{{sc-ops-vendors-db}}" inline="true">Vendors</database>
`
      : ""

  teamspace.addPage({
    resourceId: `sc-${slug}-home`,
    icon: { type: "notion_icon", description: "home", color },
    properties: { title: notion.text("Home") },
    content: `<callout icon="👋" color="${color}_bg">
	**${team} home.** The pages below show the company-wide databases filtered to **Team = ${team}**. Add rows there or here; they're the same rows.
</callout>

# Our work

${teamViews
  .map(
    view =>
      `- <mention-page url="{{sc-${slug}-${view.key}-page}}">${view.title}</mention-page>`
  )
  .join("\n")}
${homeExtra}`,
  })

  for (const view of teamViews) {
    const page = teamspace.addPage({
      resourceId: `sc-${slug}-${view.key}-page`,
      icon: { type: "notion_icon", description: view.icon, color },
      properties: { title: notion.text(view.title) },
      fullWidth: true,
      content: `<database url="{{sc-${slug}-${view.key}-linked}}" inline="true">${team} ${view.title}</database>
`,
    })

    // Views-only linked database whose data source lives in the Company
    // teamspace — the cross-teamspace probe (test 2).
    notion.database({
      resourceId: `sc-${slug}-${view.key}-linked`,
      parent: { type: "resourceId", resourceId: page.resourceId },
      name: `${team} ${view.title}`,
      views: [
        {
          resourceId: `sc-${slug}-${view.key}-view`,
          name: team,
          type: view.type,
          dataSourceResourceId: view.dataSource,
          filters: [
            {
              propertyId: view.teamProp,
              propertyType: "select",
              operator: "enum_is",
              value: team,
            },
          ],
          sorts: view.sorts,
        },
      ],
    })
  }
}

// Operations-only database, inside the Operations Home page.
const vendorsDb = notion.database({
  resourceId: "sc-ops-vendors-db",
  parent: { type: "resourceId", resourceId: "sc-ops-home" },
  name: "Vendors",
  icon: { type: "notion_icon", description: "truck", color: "blue" },
  description: "Suppliers the Operations team manages. Operations-only.",
  dataSources: [
    {
      resourceId: "sc-vendors-ds",
      name: "Vendors",
      properties: [
        { resourceId: "sc-vd-name", name: "Name", type: "title" },
        {
          resourceId: "sc-vd-category",
          name: "Category",
          type: "select",
          options: [
            { name: "Logistics", color: "blue" },
            { name: "Facilities", color: "brown" },
            { name: "Software", color: "purple" },
          ],
        },
        { resourceId: "sc-vd-renewal", name: "Contract renewal", type: "date" },
        { resourceId: "sc-vd-website", name: "Website", type: "url" },
      ],
    },
  ],
})

vendorsDb.addView({
  resourceId: "sc-vendors-all-view",
  name: "All vendors",
  type: "table",
  dataSourceResourceId: "sc-vendors-ds",
  sorts: [{ propertyId: "sc-vd-renewal", direction: "ascending" }],
})

// ---------------------------------------------------------------------------
// Sample rows (fictional)
// ---------------------------------------------------------------------------

const projectsDs = projectsDb.getDataSource("sc-projects-ds")
const tasksDs = tasksDb.getDataSource("sc-tasks-ds")
const meetingsDs = meetingsDb.getDataSource("sc-meetings-ds")
const docsDs = docsDb.getDataSource("sc-docs-ds")
const vendorsDs = vendorsDb.getDataSource("sc-vendors-ds")

// Projects
projectsDs.addPage({
  resourceId: "sc-pj-warehouse",
  properties: {
    Name: notion.text("Warehouse layout refresh"),
    Status: notion.status("Active"),
    Team: notion.select("Operations"),
    Dates: notion.date("2026-10-01", "2026-12-15"),
    Summary: notion.text("Re-slot the fast movers closer to dispatch to cut pick times."),
  },
})
projectsDs.addPage({
  resourceId: "sc-pj-vendor-review",
  properties: {
    Name: notion.text("Annual vendor review"),
    Status: notion.status("Planned"),
    Team: notion.select("Operations"),
    Dates: notion.date("2026-11-01", "2026-11-30"),
    Summary: notion.text("Score every vendor on cost, reliability and service before renewals."),
  },
})
projectsDs.addPage({
  resourceId: "sc-pj-q4-campaign",
  properties: {
    Name: notion.text("Q4 product campaign"),
    Status: notion.status("Active"),
    Team: notion.select("Marketing"),
    Dates: notion.date("2026-10-06", "2026-12-19"),
    Summary: notion.text("Launch campaign for the winter range across email, social and paid."),
  },
})

// Tasks
const tasks: Array<{
  id: string
  name: string
  status: string
  team: Team
  due: string
  project: string
}> = [
  { id: "sc-tk-measure", name: "Measure current pick paths", status: "Done", team: "Operations", due: "2026-10-10", project: "sc-pj-warehouse" },
  { id: "sc-tk-slotting", name: "Draft new slotting plan", status: "In progress", team: "Operations", due: "2026-10-24", project: "sc-pj-warehouse" },
  { id: "sc-tk-scorecard", name: "Build vendor scorecard", status: "Not started", team: "Operations", due: "2026-11-07", project: "sc-pj-vendor-review" },
  { id: "sc-tk-brief", name: "Write campaign brief", status: "Done", team: "Marketing", due: "2026-10-09", project: "sc-pj-q4-campaign" },
  { id: "sc-tk-creative", name: "Brief the design agency", status: "In progress", team: "Marketing", due: "2026-10-23", project: "sc-pj-q4-campaign" },
  { id: "sc-tk-email", name: "Schedule launch email", status: "Not started", team: "Marketing", due: "2026-11-03", project: "sc-pj-q4-campaign" },
]
for (const task of tasks) {
  tasksDs.addPage({
    resourceId: task.id,
    properties: {
      Name: notion.text(task.name),
      Status: notion.status(task.status),
      Team: notion.select(task.team),
      Due: notion.date(task.due),
      Project: notion.relation([task.project]),
    },
  })
}

// Meeting Notes
meetingsDs.addPage({
  resourceId: "sc-mt-warehouse-kickoff",
  properties: {
    Name: notion.text("Warehouse refresh kickoff"),
    Date: notion.date("2026-10-02"),
    Team: notion.select("Operations"),
    Type: notion.select("Planning"),
    Project: notion.relation(["sc-pj-warehouse"]),
    "Action Items": notion.relation(["sc-tk-measure", "sc-tk-slotting"]),
  },
  content: `# Decisions

- Measure current pick paths before changing anything.
- Target: 20% shorter average pick path by mid-December.
`,
})
meetingsDs.addPage({
  resourceId: "sc-mt-ops-standup",
  properties: {
    Name: notion.text("Ops weekly standup"),
    Date: notion.date("2026-10-13"),
    Team: notion.select("Operations"),
    Type: notion.select("Standup"),
    "Action Items": notion.relation(["sc-tk-scorecard"]),
  },
})
meetingsDs.addPage({
  resourceId: "sc-mt-campaign-planning",
  properties: {
    Name: notion.text("Q4 campaign planning"),
    Date: notion.date("2026-10-07"),
    Team: notion.select("Marketing"),
    Type: notion.select("Planning"),
    Project: notion.relation(["sc-pj-q4-campaign"]),
    "Action Items": notion.relation(["sc-tk-creative", "sc-tk-email"]),
  },
  content: `# Decisions

- Lead with email; social and paid follow a week later.
- Agency gets the brief by 23 October.
`,
})

// Docs
docsDs.addPage({
  resourceId: "sc-dc-receiving",
  properties: {
    Name: notion.text("Receiving and put-away procedure"),
    Team: notion.select("Operations"),
    Type: notion.select("Guide"),
    Project: notion.relation(["sc-pj-warehouse"]),
  },
  content: `# Steps

1. Check the delivery against the purchase order.
2. Label every pallet with its bin location.
3. Put away fast movers first.
`,
})
docsDs.addPage({
  resourceId: "sc-dc-brand",
  properties: {
    Name: notion.text("Brand voice guidelines"),
    Team: notion.select("Marketing"),
    Type: notion.select("Policy"),
  },
})
docsDs.addPage({
  resourceId: "sc-dc-campaign-spec",
  properties: {
    Name: notion.text("Q4 campaign spec"),
    Team: notion.select("Marketing"),
    Type: notion.select("Spec"),
    Project: notion.relation(["sc-pj-q4-campaign"]),
  },
})

// Vendors (Operations-only)
vendorsDs.addPage({
  resourceId: "sc-vd-northline",
  properties: {
    Name: notion.text("Northline Freight"),
    Category: notion.select("Logistics"),
    "Contract renewal": notion.date("2027-01-31"),
    Website: notion.url("https://northlinefreight.example"),
  },
})
vendorsDs.addPage({
  resourceId: "sc-vd-cleanspace",
  properties: {
    Name: notion.text("CleanSpace Facilities"),
    Category: notion.select("Facilities"),
    "Contract renewal": notion.date("2026-12-31"),
  },
})
vendorsDs.addPage({
  resourceId: "sc-vd-stocktrack",
  properties: {
    Name: notion.text("StockTrack WMS"),
    Category: notion.select("Software"),
    "Contract renewal": notion.date("2027-03-15"),
    Website: notion.url("https://stocktrack.example"),
  },
})

export {}
