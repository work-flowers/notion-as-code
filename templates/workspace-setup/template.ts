/**
 * The workFlowers core workspace template (TKT-978), as a Notion as Code
 * function of a WorkspaceSpec.
 *
 * Build scripts can't import other files (the SDK wraps the script in a
 * function and runs it from a temp dir), so tools/new-build.ts copies the code
 * between the <template> markers into each generated builds/<client>/build.ts,
 * next to the spec and its types. Keep that region self-contained: it may use
 * the `notion` global, the DSL's global types and the WorkspaceSpec types, and
 * nothing else from this file.
 *
 * The design is the playbook's "Standard schema" section:
 * https://app.notion.com/p/3fb91b0711ac81c59c44eea9bfbc608c
 *
 * Every resourceId is derived from the client prefix plus spec keys, so the
 * same spec always gives the same IDs. Never change a key or the prefix after
 * a deploy.
 */
import type { CoreDatabase, PropertySpec, WorkspaceSpec } from "./spec"

// <template>
function buildWorkspace(spec: WorkspaceSpec, prefix: string, spaceAnchor: string) {
  const spaceParent = { type: "resourceId", resourceId: spaceAnchor } as const
  const at = (resourceId: string) => ({ type: "resourceId", resourceId }) as const

  /** Escapes text for Notion-flavoured Markdown content. */
  const md = (text: string) => text.replace(/[\\*~`$[\]<>{}|^]/g, ch => `\\${ch}`)
  const paragraphs = (text: string) =>
    text
      .split(/\n\s*\n/)
      .map(block => md(block.trim()))
      .filter(Boolean)
      .join("\n\n")

  // -------------------------------------------------------------------------
  // IDs
  // -------------------------------------------------------------------------

  const slugOf: Record<CoreDatabase, string> = {
    projects: "projects",
    tasks: "tasks",
    meetingNotes: "meetings",
    docs: "docs",
  }
  const core = {
    page: (db: CoreDatabase) => `${prefix}-${slugOf[db]}-page`,
    db: (db: CoreDatabase) => `${prefix}-${slugOf[db]}-db`,
    ds: (db: CoreDatabase) => `${prefix}-${slugOf[db]}-ds`,
    prop: (db: CoreDatabase, key: string) => `${prefix}-${slugOf[db]}-${key}`,
    /** Spec-added properties get their own namespace so they can't hit a standard key. */
    extraProp: (db: CoreDatabase, key: string) => `${prefix}-${slugOf[db]}-x-${key}`,
    view: (db: CoreDatabase, key: string) => `${prefix}-${slugOf[db]}-view-${key}`,
  }
  const team = {
    teamspace: (t: string) => `${prefix}-t-${t}`,
    home: (t: string) => `${prefix}-t-${t}-home`,
    page: (t: string, db: CoreDatabase) => `${prefix}-t-${t}-${slugOf[db]}-page`,
    linked: (t: string, db: CoreDatabase) => `${prefix}-t-${t}-${slugOf[db]}-linked`,
    view: (t: string, db: CoreDatabase) => `${prefix}-t-${t}-${slugOf[db]}-view`,
  }
  const teamDb = {
    db: (key: string) => `${prefix}-tdb-${key}-db`,
    ds: (key: string) => `${prefix}-tdb-${key}-ds`,
    title: (key: string) => `${prefix}-tdb-${key}-name`,
    prop: (key: string, propKey: string) => `${prefix}-tdb-${key}-p-${propKey}`,
    view: (key: string) => `${prefix}-tdb-${key}-view-all`,
  }
  const companyTeamspaceId = `${prefix}-company`
  const companyHomeId = `${prefix}-company-home`

  // -------------------------------------------------------------------------
  // Shared property shapes
  // -------------------------------------------------------------------------

  const teamOptions = spec.teams.map(t => ({ name: t.name, color: t.color ?? "default" }))

  const statusOptions = {
    todo: [{ name: "Not started", color: "gray" as const, default: true }],
    inProgress: [{ name: "In progress", color: "blue" as const }],
    complete: [
      { name: "Done", color: "green" as const },
      { name: "Cancelled", color: "red" as const },
    ],
  }
  const priorityOptions = [
    { name: "High", color: "red" as const },
    { name: "Medium", color: "yellow" as const },
    { name: "Low", color: "gray" as const },
  ]

  /** A spec property as a DSL property. Relations are one-way. */
  function fromSpec(prop: PropertySpec, resourceId: string): PropertySchemaDefinition {
    const base = { resourceId, name: prop.name }
    switch (prop.type) {
      case "select":
      case "multi_select":
        return { ...base, type: prop.type, options: (prop.options ?? []).map(name => ({ name })) }
      case "status": {
        const options = (prop.options ?? []).map(name => ({ name }))
        return {
          ...base,
          type: "status",
          options: {
            todo: [{ ...options[0]!, default: true }],
            inProgress: options.slice(1, -1),
            complete: options.slice(-1),
          },
        }
      }
      case "relation": {
        const target = prop.relationTo!
        return {
          ...base,
          type: "relation",
          targetDataSourceResourceId:
            typeof target === "string" ? core.ds(target) : teamDb.ds(target.teamDatabase),
        }
      }
      default:
        return { ...base, type: prop.type }
    }
  }

  const extras = (db: CoreDatabase) =>
    (spec.coreDatabases[db]?.addProperties ?? []).map(prop =>
      fromSpec(prop, core.extraProp(db, prop.key))
    )

  // -------------------------------------------------------------------------
  // Core databases: playbook "Standard schema"
  // -------------------------------------------------------------------------

  type TeamViewShape =
    | { type: "table"; sorts: Array<{ propertyId: string; direction: "ascending" | "descending" }> }
    | { type: "board"; groupBy: { property: string; type: "status" | "select" } }

  type CoreDef = {
    db: CoreDatabase
    title: string
    icon: string
    description: string
    blurb: string
    properties: PropertySchemaDefinition[]
    /** Default tabs on the company database. The first one is the team views' shape too. */
    views: Array<(viewId: (key: string) => string) => ViewSchema>
    teamView: TeamViewShape
  }

  const p = core.prop
  const coreDefs: CoreDef[] = [
    {
      db: "projects",
      title: "Projects",
      icon: "rocket",
      description: "Company-wide projects, tagged by team.",
      blurb: "pieces of work with an owner, status and dates",
      properties: [
        { resourceId: p("projects", "name"), name: "Name", type: "title" },
        { resourceId: p("projects", "team"), name: "Team", type: "multi_select", options: teamOptions },
        { resourceId: p("projects", "status"), name: "Status", type: "status", options: statusOptions },
        { resourceId: p("projects", "owner"), name: "Owner", type: "person" },
        { resourceId: p("projects", "dates"), name: "Dates", type: "date" },
        { resourceId: p("projects", "priority"), name: "Priority", type: "select", options: priorityOptions },
        { resourceId: p("projects", "summary"), name: "Summary", type: "text" },
        {
          resourceId: p("projects", "tasks"),
          name: "Tasks",
          type: "relation",
          targetDataSourceResourceId: core.ds("tasks"),
          targetDataSourcePropertyResourceId: p("tasks", "project"),
        },
        {
          resourceId: p("projects", "meetings"),
          name: "Meeting Notes",
          type: "relation",
          targetDataSourceResourceId: core.ds("meetingNotes"),
          targetDataSourcePropertyResourceId: p("meetingNotes", "project"),
        },
        {
          resourceId: p("projects", "docs"),
          name: "Docs",
          type: "relation",
          targetDataSourceResourceId: core.ds("docs"),
          targetDataSourcePropertyResourceId: p("docs", "project"),
        },
      ],
      views: [
        v => ({
          resourceId: v("board"),
          name: "Board",
          type: "board",
          dataSourceResourceId: core.ds("projects"),
          groupBy: { property: p("projects", "status"), type: "status" },
        }),
        v => ({
          resourceId: v("timeline"),
          name: "Timeline",
          type: "timeline",
          dataSourceResourceId: core.ds("projects"),
          timelineBy: p("projects", "dates"),
        }),
      ],
      teamView: { type: "board", groupBy: { property: p("projects", "status"), type: "status" } },
    },
    {
      db: "tasks",
      title: "Tasks",
      icon: "checkmark square",
      description: "Company-wide tasks, tagged by team.",
      blurb: "individual work items, usually linked to a project",
      properties: [
        { resourceId: p("tasks", "name"), name: "Name", type: "title" },
        { resourceId: p("tasks", "team"), name: "Team", type: "multi_select", options: teamOptions },
        { resourceId: p("tasks", "status"), name: "Status", type: "status", options: statusOptions },
        { resourceId: p("tasks", "assignee"), name: "Assignee", type: "person" },
        { resourceId: p("tasks", "due"), name: "Due", type: "date" },
        { resourceId: p("tasks", "priority"), name: "Priority", type: "select", options: priorityOptions },
        {
          resourceId: p("tasks", "project"),
          name: "Project",
          type: "relation",
          targetDataSourceResourceId: core.ds("projects"),
          targetDataSourcePropertyResourceId: p("projects", "tasks"),
          limit: 1,
        },
      ],
      views: [
        v => ({
          resourceId: v("board"),
          name: "Board",
          type: "board",
          dataSourceResourceId: core.ds("tasks"),
          groupBy: { property: p("tasks", "status"), type: "status" },
        }),
        v => ({
          resourceId: v("all"),
          name: "All tasks",
          type: "table",
          dataSourceResourceId: core.ds("tasks"),
          sorts: [{ propertyId: p("tasks", "due"), direction: "ascending" }],
        }),
      ],
      teamView: { type: "board", groupBy: { property: p("tasks", "status"), type: "status" } },
    },
    {
      db: "meetingNotes",
      title: "Meeting Notes",
      icon: "calendar",
      description: "Company-wide meeting notes, tagged by team.",
      blurb: "every meeting, including Notion AI meeting notes; action items go to Tasks",
      properties: [
        { resourceId: p("meetingNotes", "name"), name: "Name", type: "title" },
        { resourceId: p("meetingNotes", "team"), name: "Team", type: "multi_select", options: teamOptions },
        { resourceId: p("meetingNotes", "date"), name: "Date", type: "date" },
        {
          resourceId: p("meetingNotes", "type"),
          name: "Type",
          type: "select",
          options: [
            { name: "Team", color: "blue" },
            { name: "1:1", color: "purple" },
            { name: "Client", color: "orange" },
            { name: "All-hands", color: "green" },
          ],
        },
        { resourceId: p("meetingNotes", "attendees"), name: "Attendees", type: "person" },
        {
          resourceId: p("meetingNotes", "project"),
          name: "Project",
          type: "relation",
          targetDataSourceResourceId: core.ds("projects"),
          targetDataSourcePropertyResourceId: p("projects", "meetings"),
        },
        // One-way: Tasks gets no back-link property.
        {
          resourceId: p("meetingNotes", "action-items"),
          name: "Action Items",
          type: "relation",
          targetDataSourceResourceId: core.ds("tasks"),
        },
      ],
      views: [
        v => ({
          resourceId: v("by-date"),
          name: "By date",
          type: "table",
          dataSourceResourceId: core.ds("meetingNotes"),
          sorts: [{ propertyId: p("meetingNotes", "date"), direction: "descending" }],
        }),
        v => ({
          resourceId: v("calendar"),
          name: "Calendar",
          type: "calendar",
          dataSourceResourceId: core.ds("meetingNotes"),
          calendarBy: p("meetingNotes", "date"),
        }),
      ],
      teamView: {
        type: "table",
        sorts: [{ propertyId: p("meetingNotes", "date"), direction: "descending" }],
      },
    },
    {
      db: "docs",
      title: "Docs",
      icon: "document",
      description: "Company-wide docs, tagged by team.",
      blurb: "wiki pages, policies, specs and reference material",
      properties: [
        { resourceId: p("docs", "name"), name: "Name", type: "title" },
        { resourceId: p("docs", "team"), name: "Team", type: "multi_select", options: teamOptions },
        {
          resourceId: p("docs", "type"),
          name: "Type",
          type: "select",
          options: [
            { name: "Policy", color: "red" },
            { name: "Guide", color: "green" },
            { name: "Reference", color: "blue" },
          ],
        },
        { resourceId: p("docs", "owner"), name: "Owner", type: "person" },
        { resourceId: p("docs", "last-reviewed"), name: "Last reviewed", type: "date" },
        {
          resourceId: p("docs", "project"),
          name: "Project",
          type: "relation",
          targetDataSourceResourceId: core.ds("projects"),
          targetDataSourcePropertyResourceId: p("projects", "docs"),
        },
      ],
      views: [
        v => ({
          resourceId: v("all"),
          name: "All docs",
          type: "table",
          dataSourceResourceId: core.ds("docs"),
          sorts: [{ propertyId: p("docs", "name"), direction: "ascending" }],
        }),
        v => ({
          resourceId: v("by-type"),
          name: "By type",
          type: "board",
          dataSourceResourceId: core.ds("docs"),
          groupBy: { property: p("docs", "type"), type: "select" },
        }),
      ],
      teamView: {
        type: "table",
        sorts: [{ propertyId: p("docs", "name"), direction: "ascending" }],
      },
    },
  ]

  const coreIcon = (def: CoreDef) =>
    ({ type: "notion_icon", description: def.icon, color: "gray" }) as const

  // -------------------------------------------------------------------------
  // Company teamspace: Home + one page per core database
  // -------------------------------------------------------------------------

  // `default` access: every member auto-joins. It only applies on create
  // (finding 24), so it has to be right on the first deploy.
  const company = notion.teamspace({
    resourceId: companyTeamspaceId,
    parent: spaceParent,
    name: spec.companyTeamspace.name,
    accessLevel: "default",
    icon: spec.companyTeamspace.icon,
    description: spec.companyTeamspace.description,
  })

  const companyIntro =
    spec.homePages.company ??
    "Start here. The four core databases below hold every record; each team works from filtered views of them in its own teamspace."

  const teamLinks = spec.teams.map(
    t => `- <mention-page url="{{${team.home(t.key)}}}">${md(t.name)}</mention-page>`
  )

  company.addPage({
    resourceId: companyHomeId,
    icon: { type: "notion_icon", description: "home", color: "gray" },
    properties: { title: notion.text("Home") },
    content: `${paragraphs(companyIntro)}

# Core databases

${coreDefs
  .map(def => `- <mention-page url="{{${core.page(def.db)}}}">${def.title}</mention-page> — ${def.blurb}`)
  .join("\n")}
${teamLinks.length > 0 ? `\n# Teams\n\n${teamLinks.join("\n")}\n` : ""}`,
  })

  for (const def of coreDefs) {
    company.addPage({
      resourceId: core.page(def.db),
      icon: coreIcon(def),
      properties: { title: notion.text(def.title) },
      fullWidth: true,
      content: `<database url="{{${core.db(def.db)}}}" inline="true">${def.title}</database>\n`,
    })

    const database = notion.database({
      resourceId: core.db(def.db),
      parent: at(core.page(def.db)),
      name: def.title,
      icon: coreIcon(def),
      description: def.description,
      dataSources: [
        {
          resourceId: core.ds(def.db),
          name: def.title,
          properties: [...def.properties, ...extras(def.db)],
        },
      ],
    })
    for (const view of def.views) database.addView(view(key => core.view(def.db, key)))
  }

  // -------------------------------------------------------------------------
  // Team teamspaces: Home + four pages of filtered linked views
  // -------------------------------------------------------------------------

  for (const t of spec.teams) {
    const teamspace = notion.teamspace({
      resourceId: team.teamspace(t.key),
      parent: spaceParent,
      name: t.name,
      accessLevel: t.access,
      icon: t.icon,
      description: `${t.name} team home. Views of the company databases, filtered to ${t.name}.`,
    })

    const ownDatabases = spec.teamDatabases.filter(d => d.team === t.key)
    const intro =
      spec.homePages.teams?.[t.key] ??
      `${t.name} team home. The pages below show the company-wide databases filtered to ${t.name}; they're the same rows, so tag new rows with Team = ${t.name}.`

    teamspace.addPage({
      resourceId: team.home(t.key),
      icon: t.icon,
      properties: { title: notion.text("Home") },
      content: `${paragraphs(intro)}

# Our work

${coreDefs
  .map(
    def =>
      `- <mention-page url="{{${team.page(t.key, def.db)}}}">${md(t.name)} ${def.title}</mention-page>`
  )
  .join("\n")}

Company-wide: <mention-page url="{{${companyHomeId}}}">Home</mention-page>
${
  ownDatabases.length > 0
    ? `\n# Team databases\n\n${ownDatabases
        .map(d => `<database url="{{${teamDb.db(d.key)}}}" inline="true">${md(d.name)}</database>`)
        .join("\n\n")}\n`
    : ""
}`,
    })

    for (const def of coreDefs) {
      const title = `${t.name} ${def.title}`
      teamspace.addPage({
        resourceId: team.page(t.key, def.db),
        icon: coreIcon(def),
        properties: { title: notion.text(title) },
        fullWidth: true,
        content: `<database url="{{${team.linked(t.key, def.db)}}}" inline="true">${md(title)}</database>\n`,
      })

      // Views-only linked database on the company data source. The filter
      // lands as a quick filter (finding 21): save it by hand after deploy.
      notion.database({
        resourceId: team.linked(t.key, def.db),
        parent: at(team.page(t.key, def.db)),
        name: title,
        views: [
          {
            resourceId: team.view(t.key, def.db),
            name: t.name,
            dataSourceResourceId: core.ds(def.db),
            filters: [
              {
                propertyId: core.prop(def.db, "team"),
                propertyType: "multi_select",
                operator: "enum_contains",
                value: t.name,
              },
            ],
            ...def.teamView,
          },
        ],
      })
    }
  }

  // -------------------------------------------------------------------------
  // Team databases, nested in the owning team's Home page
  // -------------------------------------------------------------------------

  for (const d of spec.teamDatabases) {
    const database = notion.database({
      resourceId: teamDb.db(d.key),
      parent: at(team.home(d.team)),
      name: d.name,
      icon: d.icon,
      description: d.purpose,
      dataSources: [
        {
          resourceId: teamDb.ds(d.key),
          name: d.name,
          properties: [
            { resourceId: teamDb.title(d.key), name: "Name", type: "title" },
            ...d.properties.map(prop => fromSpec(prop, teamDb.prop(d.key, prop.key))),
          ],
        },
      ],
    })
    database.addView({
      resourceId: teamDb.view(d.key),
      name: `All ${d.name.toLowerCase()}`,
      type: "table",
      dataSourceResourceId: teamDb.ds(d.key),
      sorts: [{ propertyId: teamDb.title(d.key), direction: "ascending" }],
    })
  }
}
// </template>

export { buildWorkspace }
