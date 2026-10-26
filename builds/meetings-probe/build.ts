/**
 * meetings-probe — can a script build the attendee-only Meeting Notes layout?
 * (TKT-1032)
 *
 * Demo workspace only (non-private teamspaces allowed there; see
 * docs/GUARDRAILS.md). Its own build, so its re-deploys can't clear another
 * build's relation values (finding 18).
 *
 * The permissions guide's attendee model gives members No access to the
 * Meeting Notes source database and shows them meetings through linked views
 * only. What each piece probes:
 *   - Meeting Notes source database in a private "admin-only" teamspace, with
 *     a "Shared with" person property next to Attendees and Created by.
 *     The DSL has no database type, so this is an ordinary database, not the
 *     meetings type (finding 34).
 *   - An open teamspace with a Meeting Notes page made only of linked views of
 *     that database: My meetings, Recent, Calendar.
 *   - A Projects database whose page layout has a Meeting Notes tab: a view of
 *     the source database, declared on it (finding 25's rule), filtered to
 *     `this_page`. The source sits in another, private teamspace.
 *
 * Meeting Notes → Project is two-way with a back-link on Projects, like the
 * core template.
 */

const spaceParent = {
  type: "resourceId",
  resourceId: "mtp-demo-space",
} as const
const at = (resourceId: string) => ({ type: "resourceId", resourceId }) as const

// ---------------------------------------------------------------------------
// Admin teamspace: the source database
// ---------------------------------------------------------------------------

const adminTeamspace = notion.teamspace({
  resourceId: "mtp-admin-teamspace",
  parent: spaceParent,
  name: "Meetings Probe Admin",
  accessLevel: "private",
  icon: { type: "notion_icon", description: "lock", color: "red" },
  description: "Notion as Code probe (TKT-1032): the Meeting Notes source database, admin-only.",
})

adminTeamspace.addPage({
  resourceId: "mtp-admin-source-page",
  icon: { type: "notion_icon", description: "lock", color: "red" },
  properties: { title: notion.text("Meeting Notes (source)") },
  content: `Created by the **meetings-probe** build. Safe to delete.

The source database for Meeting Notes. Only admins open it; everyone else uses the linked views on the Meeting Notes page.

<database url="{{mtp-meetings-db}}" inline="true">Probe Meeting Notes</database>
`,
})

const meetingsDb = notion.database({
  resourceId: "mtp-meetings-db",
  parent: at("mtp-admin-source-page"),
  name: "Probe Meeting Notes",
  icon: { type: "notion_icon", description: "calendar", color: "red" },
  dataSources: [
    {
      resourceId: "mtp-meetings-ds",
      name: "Probe Meeting Notes",
      properties: [
        { resourceId: "mtp-mt-name", name: "Name", type: "title" },
        { resourceId: "mtp-mt-date", name: "Date", type: "date" },
        { resourceId: "mtp-mt-attendees", name: "Attendees", type: "person" },
        { resourceId: "mtp-mt-shared-with", name: "Shared with", type: "person" },
        { resourceId: "mtp-mt-created-by", name: "Created by", type: "created_by" },
        {
          resourceId: "mtp-mt-project",
          name: "Project",
          type: "relation",
          targetDataSourceResourceId: "mtp-projects-ds",
          targetDataSourcePropertyResourceId: "mtp-pj-meetings",
        },
      ],
    },
  ],
  views: [
    {
      resourceId: "mtp-meetings-all-view",
      name: "All meetings",
      type: "table",
      dataSourceResourceId: "mtp-meetings-ds",
      sorts: [{ propertyId: "mtp-mt-date", direction: "descending" }],
    },
  ],
})

// The Projects page-layout tab. It has to be declared on the Meeting Notes
// database, its own data source's (finding 25).
meetingsDb.addView({
  resourceId: "mtp-project-meetings-tab-view",
  name: "Meeting Notes",
  icon: { type: "notion_icon", description: "calendar" },
  type: "table",
  dataSourceResourceId: "mtp-meetings-ds",
  ephemeral: true,
  sorts: [{ propertyId: "mtp-mt-date", direction: "descending" }],
  filters: [
    {
      type: "advanced",
      operator: "and",
      filters: [
        {
          type: "property",
          propertyId: "mtp-mt-project",
          propertyType: "relation",
          operator: "relation_contains",
          value: { type: "relative", value: "this_page" },
        },
      ],
    },
  ],
})

// ---------------------------------------------------------------------------
// Company teamspace: the Meeting Notes page (linked views) and Projects
// ---------------------------------------------------------------------------

const companyTeamspace = notion.teamspace({
  resourceId: "mtp-company-teamspace",
  parent: spaceParent,
  name: "Meetings Probe",
  accessLevel: "open",
  icon: { type: "notion_icon", description: "flask", color: "purple" },
  description: "Notion as Code probe (TKT-1032): Meeting Notes as linked views of an admin-only database.",
})

companyTeamspace.addPage({
  resourceId: "mtp-hub",
  icon: { type: "notion_icon", description: "flask", color: "purple" },
  properties: { title: notion.text("About this probe") },
  content: `Created by the **meetings-probe** build. Safe to delete.

- <mention-page url="{{mtp-meetings-page}}">Meeting Notes</mention-page> has only linked views of the source database, which lives in the private Meetings Probe Admin teamspace.
- Open a project below. Its **Meeting Notes** tab should list only that project's meetings.

<database url="{{mtp-projects-db}}" inline="true">Probe Projects</database>
`,
})

const projectsDb = notion.database({
  resourceId: "mtp-projects-db",
  parent: at("mtp-hub"),
  name: "Probe Projects",
  icon: { type: "notion_icon", description: "rocket", color: "purple" },
  dataSources: [
    {
      resourceId: "mtp-projects-ds",
      name: "Probe Projects",
      properties: [
        { resourceId: "mtp-pj-name", name: "Name", type: "title" },
        {
          resourceId: "mtp-pj-meetings",
          name: "Meeting Notes",
          type: "relation",
          targetDataSourceResourceId: "mtp-meetings-ds",
          targetDataSourcePropertyResourceId: "mtp-mt-project",
        },
      ],
      pageLayout: {
        main: [{ type: "properties" }],
        tabs: [
          { type: "content", name: "Overview" },
          { type: "view", resourceId: "mtp-project-meetings-tab-view" },
        ],
      },
    },
  ],
  views: [
    {
      resourceId: "mtp-projects-all-view",
      name: "All projects",
      type: "table",
      dataSourceResourceId: "mtp-projects-ds",
    },
  ],
})

companyTeamspace.addPage({
  resourceId: "mtp-meetings-page",
  icon: { type: "notion_icon", description: "calendar", color: "purple" },
  properties: { title: notion.text("Meeting Notes") },
  fullWidth: true,
  content: `<database url="{{mtp-meetings-linked}}" inline="true">Meeting Notes</database>
`,
})

const isMe = (
  propertyId: string,
  propertyType: "person" | "created_by",
) => ({
  type: "property" as const,
  propertyId,
  propertyType,
  operator: "person_contains" as const,
  value: [{ type: "relative" as const, value: "me" as const }] as [{ type: "relative"; value: "me" }],
})

// Views-only linked database on the admin-only source.
notion.database({
  resourceId: "mtp-meetings-linked",
  parent: at("mtp-meetings-page"),
  name: "Meeting Notes",
  views: [
    {
      resourceId: "mtp-linked-my-view",
      name: "My meetings",
      type: "table",
      dataSourceResourceId: "mtp-meetings-ds",
      sorts: [{ propertyId: "mtp-mt-date", direction: "descending" }],
      filters: [
        {
          type: "advanced",
          operator: "or",
          filters: [
            isMe("mtp-mt-attendees", "person"),
            isMe("mtp-mt-shared-with", "person"),
            isMe("mtp-mt-created-by", "created_by"),
          ],
        },
      ],
    },
    {
      resourceId: "mtp-linked-recent-view",
      name: "Recent",
      type: "table",
      dataSourceResourceId: "mtp-meetings-ds",
      sorts: [{ propertyId: "mtp-mt-date", direction: "descending" }],
      filters: [
        {
          type: "advanced",
          operator: "and",
          filters: [
            {
              type: "property",
              propertyId: "mtp-mt-date",
              propertyType: "date",
              operator: "date_is_relative_to",
              value: { type: "relative_to_today", value: { direction: "past", count: 30, unit: "day" } },
            },
          ],
        },
      ],
    },
    {
      resourceId: "mtp-linked-calendar-view",
      name: "Calendar",
      type: "calendar",
      dataSourceResourceId: "mtp-meetings-ds",
      calendarBy: "mtp-mt-date",
    },
  ],
})

// ---------------------------------------------------------------------------
// Seed rows. Dates are relative to the first deploy (planned 2026-10-26).
// People properties are left empty: Created by is the token's owner.
// ---------------------------------------------------------------------------

const projects = projectsDb.dataSources["mtp-projects-ds"]
projects.addPage({
  resourceId: "mtp-project-alpha",
  icon: { type: "notion_icon", description: "rocket", color: "blue" },
  properties: { Name: notion.text("Alpha") },
})
projects.addPage({
  resourceId: "mtp-project-beta",
  icon: { type: "notion_icon", description: "rocket", color: "orange" },
  properties: { Name: notion.text("Beta") },
})

const meetings = meetingsDb.dataSources["mtp-meetings-ds"]
meetings.addPage({
  resourceId: "mtp-meeting-alpha-kickoff",
  properties: {
    Name: notion.text("Alpha kick-off"),
    Date: notion.date("2026-10-20"),
    Project: notion.relation(["mtp-project-alpha"]),
  },
})
meetings.addPage({
  resourceId: "mtp-meeting-alpha-review",
  properties: {
    Name: notion.text("Alpha review"),
    Date: notion.date("2026-10-26"),
    Project: notion.relation(["mtp-project-alpha"]),
  },
})
meetings.addPage({
  resourceId: "mtp-meeting-beta-old",
  properties: {
    Name: notion.text("Beta planning (older than 30 days)"),
    Date: notion.date("2026-09-01"),
    Project: notion.relation(["mtp-project-beta"]),
  },
})

export {}
