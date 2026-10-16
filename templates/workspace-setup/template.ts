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
 * Generated builds run on the ntn engine (`"engine": "ntn"`), so the DSL is
 * vendor/ntn-template/types.d.ts. PropertySchemaDefinition and ViewSchema are
 * made global by vendor/ntn-template/globals.d.ts.
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

  type PropertyFilter = Extract<FilterSchema[number], { type: "property" }>
  type Sort = { propertyId: string; direction: "ascending" | "descending" }

  /**
   * One tab, as both the company database and every team's linked database
   * show it. `filters` are the tab's own; team tabs add Team contains <team>.
   */
  type GroupBy =
    | { property: string; type: "select" }
    /** "option": one column per status option, not one per status group. */
    | { property: string; type: "status"; statusBy?: "group" | "option" }
  /** Properties shown on board cards, in order. */
  type Shown = Array<{ property: string; visible: true }>
  type TabDef = { key: string; name: string; filters?: PropertyFilter[] } & (
    | { type: "table"; sorts?: Sort[]; groupBy?: GroupBy }
    | { type: "board"; groupBy: GroupBy; properties?: Shown }
    | { type: "timeline"; timelineBy: string; sorts?: Sort[] }
    | { type: "calendar"; calendarBy: string }
  )

  /**
   * Filters go in a one-member-or-more `and` group: a lone filter lands as a
   * quick filter that viewers can clear (finding 21), a group as the saved
   * filter (finding 27).
   */
  const saved = (filters: PropertyFilter[]): FilterSchema | undefined =>
    filters.length > 0 ? [{ type: "advanced", operator: "and", filters }] : undefined
  const show = (...properties: string[]): Shown => properties.map(property => ({ property, visible: true }))
  const isMe = (propertyId: string): PropertyFilter => ({
    type: "property",
    propertyId,
    propertyType: "person",
    operator: "person_contains",
    value: [{ type: "relative", value: "me" }],
  })

  type CoreDef = {
    db: CoreDatabase
    title: string
    icon: string
    description: string
    blurb: string
    properties: PropertySchemaDefinition[]
    /** Tabs, in order. Team pages show the same tabs, filtered to the team. */
    tabs: TabDef[]
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
      tabs: [
        {
          key: "board",
          name: "Board",
          type: "board",
          groupBy: { property: p("projects", "status"), type: "status", statusBy: "option" },
          properties: show(p("projects", "name"), p("projects", "priority"), p("projects", "owner"), p("projects", "team")),
        },
        {
          key: "timeline",
          name: "Timeline",
          type: "timeline",
          timelineBy: p("projects", "dates"),
          sorts: [{ propertyId: p("projects", "dates"), direction: "ascending" }],
        },
        {
          key: "all",
          name: "All projects",
          type: "table",
          sorts: [{ propertyId: p("projects", "dates"), direction: "ascending" }],
        },
        {
          key: "active",
          name: "Active projects",
          type: "table",
          filters: [{ type: "property", propertyId: p("projects", "status"), propertyType: "status", operator: "status_is", value: ["In progress"] }],
          sorts: [{ propertyId: p("projects", "dates"), direction: "ascending" }],
        },
        {
          key: "mine",
          name: "My projects",
          type: "table",
          filters: [isMe(p("projects", "owner"))],
          sorts: [{ propertyId: p("projects", "dates"), direction: "ascending" }],
        },
      ],
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
        // Back-link of Meeting Notes → Action Items, so a meeting page can have
        // an Action Items tab (a Tasks view filtered to this meeting).
        {
          resourceId: p("tasks", "meeting"),
          name: "Meeting",
          type: "relation",
          targetDataSourceResourceId: core.ds("meetingNotes"),
          targetDataSourcePropertyResourceId: p("meetingNotes", "action-items"),
        },
      ],
      tabs: [
        {
          key: "board",
          name: "Board",
          type: "board",
          groupBy: { property: p("tasks", "status"), type: "status", statusBy: "option" },
          properties: show(p("tasks", "name"), p("tasks", "assignee"), p("tasks", "due"), p("tasks", "priority"), p("tasks", "team"), p("tasks", "project")),
        },
        {
          key: "all",
          name: "All tasks",
          type: "table",
          sorts: [{ propertyId: p("tasks", "due"), direction: "ascending" }],
        },
        {
          key: "open",
          name: "Open tasks",
          type: "table",
          filters: [
            { type: "property", propertyId: p("tasks", "status"), propertyType: "status", operator: "status_is_not", value: ["Done"] },
            { type: "property", propertyId: p("tasks", "status"), propertyType: "status", operator: "status_is_not", value: ["Cancelled"] },
          ],
          sorts: [{ propertyId: p("tasks", "due"), direction: "ascending" }],
        },
        {
          key: "mine",
          name: "My tasks",
          type: "table",
          filters: [isMe(p("tasks", "assignee"))],
          sorts: [{ propertyId: p("tasks", "due"), direction: "ascending" }],
        },
      ],
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
        {
          resourceId: p("meetingNotes", "action-items"),
          name: "Action Items",
          type: "relation",
          targetDataSourceResourceId: core.ds("tasks"),
          targetDataSourcePropertyResourceId: p("tasks", "meeting"),
        },
      ],
      tabs: [
        {
          key: "by-date",
          name: "By date",
          type: "table",
          sorts: [{ propertyId: p("meetingNotes", "date"), direction: "descending" }],
        },
        { key: "calendar", name: "Calendar", type: "calendar", calendarBy: p("meetingNotes", "date") },
        {
          key: "mine",
          name: "My meetings",
          type: "table",
          filters: [isMe(p("meetingNotes", "attendees"))],
          sorts: [{ propertyId: p("meetingNotes", "date"), direction: "descending" }],
        },
      ],
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
      tabs: [
        {
          key: "all",
          name: "All docs",
          type: "table",
          sorts: [{ propertyId: p("docs", "name"), direction: "ascending" }],
        },
        {
          key: "by-type",
          name: "By type",
          type: "table",
          groupBy: { property: p("docs", "type"), type: "select" },
          sorts: [{ propertyId: p("docs", "name"), direction: "ascending" }],
        },
      ],
    },
  ]

  /** addPage on each data source the template creates, keyed by data source resourceId. */
  const addRow: Record<
    string,
    (args: { resourceId: string; icon?: { type: "emoji"; emoji: string }; properties: Record<string, any>; content?: string }) => void
  > = {}

  const coreIcon = (def: CoreDef) =>
    ({ type: "notion_icon", description: def.icon, color: "gray" }) as const

  // -------------------------------------------------------------------------
  // Page layouts (Dennis's clean-database-page-layouts principles): up to four
  // short pins under the title, long text as its own block in the content
  // area, everything else in one "Details" side-pane section, collection
  // relations always hidden there and shown as tabs instead.
  // -------------------------------------------------------------------------

  /**
   * A tab on every `owner` page, listing `db` rows whose `via` relation points
   * at the page being viewed (`this_page`). The server needs the view declared
   * on its own database; `ephemeral` keeps it out of that database's tabs.
   */
  type RelatedTab = { owner: CoreDatabase; db: CoreDatabase; via: string; key: string; name: string; sorts: Sort[]; show: string[] }
  const relatedTabs: RelatedTab[] = [
    {
      owner: "projects",
      db: "tasks",
      via: "project",
      key: "project-tab",
      name: "Tasks",
      sorts: [{ propertyId: p("tasks", "due"), direction: "ascending" }],
      show: [p("tasks", "name"), p("tasks", "status"), p("tasks", "assignee"), p("tasks", "due"), p("tasks", "priority")],
    },
    {
      owner: "projects",
      db: "meetingNotes",
      via: "project",
      key: "project-tab",
      name: "Meeting Notes",
      sorts: [{ propertyId: p("meetingNotes", "date"), direction: "descending" }],
      show: [p("meetingNotes", "name"), p("meetingNotes", "date"), p("meetingNotes", "type"), p("meetingNotes", "attendees")],
    },
    {
      owner: "projects",
      db: "docs",
      via: "project",
      key: "project-tab",
      name: "Docs",
      sorts: [{ propertyId: p("docs", "name"), direction: "ascending" }],
      show: [p("docs", "name"), p("docs", "type"), p("docs", "owner"), p("docs", "last-reviewed")],
    },
    {
      owner: "meetingNotes",
      db: "tasks",
      via: "meeting",
      key: "meeting-tab",
      name: "Action Items",
      sorts: [{ propertyId: p("tasks", "due"), direction: "ascending" }],
      show: [p("tasks", "name"), p("tasks", "status"), p("tasks", "assignee"), p("tasks", "due"), p("tasks", "priority")],
    },
  ]

  type LayoutDef = {
    /**
     * Short, decision-useful properties under the title (the principles say up
     * to four; Dennis wants Team pinned everywhere, and Project on Tasks).
     */
    pins: string[]
    /** Long text shown as its own block, inside the Content tab when there are tabs. */
    blocks?: string[]
    /** The side pane's "Details" section, in order. Spec-added properties follow. */
    details: string[]
    /** Collection relations: always hidden in the side pane, shown as tabs. */
    collections?: string[]
    /** Name of the Content tab, when the page has related tabs. */
    contentTab?: string
  }
  const layoutDefs: Record<CoreDatabase, LayoutDef> = {
    projects: {
      pins: ["status", "owner", "dates", "priority", "team"],
      blocks: ["summary"],
      details: [],
      collections: ["tasks", "meetings", "docs"],
      contentTab: "Overview",
    },
    meetingNotes: {
      pins: ["date", "type", "attendees", "team"],
      details: ["project"],
      collections: ["action-items"],
      contentTab: "Notes",
    },
    tasks: {
      pins: ["status", "assignee", "due", "priority", "project", "team"],
      details: ["meeting"],
    },
    docs: {
      pins: ["type", "owner", "last-reviewed", "team"],
      details: ["project"],
    },
  }

  const pageLayout = (db: CoreDatabase): DatabasePageLayout => {
    const def = layoutDefs[db]
    const tabs = relatedTabs.filter(tab => tab.owner === db)
    return {
      pinnedProperties: def.pins.map(key => p(db, key)),
      main: (def.blocks ?? []).map(key => ({ type: "property" as const, property: p(db, key) })),
      sidebar: [
        {
          type: "properties",
          sections: [
            {
              name: "Details",
              properties: [
                ...def.details.map(key => ({ property: p(db, key) })),
                ...(spec.coreDatabases[db]?.addProperties ?? []).map(prop => ({
                  property: core.extraProp(db, prop.key),
                })),
                ...(def.collections ?? []).map(key => ({ property: p(db, key), visibility: "hide" as const })),
              ],
            },
          ],
        },
      ],
      ...(tabs.length > 0
        ? {
            tabs: [
              { type: "content" as const, name: def.contentTab },
              ...tabs.map(tab => ({ type: "view" as const, resourceId: core.view(tab.db, tab.key) })),
            ],
          }
        : {}),
    }
  }

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
          pageLayout: pageLayout(def.db),
        },
      ],
    })
    const coreDs = database.getDataSource(core.ds(def.db))
    addRow[core.ds(def.db)] = args => void coreDs.addPage(args as any)

    for (const tab of def.tabs) {
      const { key, filters, ...shape } = tab
      database.addView({
        ...shape,
        resourceId: core.view(def.db, key),
        dataSourceResourceId: core.ds(def.db),
        filters: saved(filters ?? []),
      })
    }

    for (const tab of relatedTabs.filter(tab => tab.db === def.db)) {
      database.addView({
        resourceId: core.view(def.db, tab.key),
        name: tab.name,
        icon: coreIcon(def),
        type: "table",
        dataSourceResourceId: core.ds(def.db),
        ephemeral: true,
        filters: saved([
          {
            type: "property",
            propertyId: core.prop(def.db, tab.via),
            propertyType: "relation",
            operator: "relation_contains",
            value: { type: "relative", value: "this_page" },
          },
        ]),
        sorts: tab.sorts,
        // A table shows unlisted properties too, so list the rest as hidden.
        properties: [
          ...tab.show.map(property => ({ property, visible: true })),
          ...[...def.properties, ...extras(def.db)]
            .map(prop => prop.resourceId)
            .filter(property => !tab.show.includes(property))
            .map(property => ({ property, visible: false })),
        ],
      })
    }
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
      properties: { title: notion.text(`${t.name} Home`) },
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

      // Views-only linked database on the company data source, with the
      // company database's tabs, each also filtered to Team contains <team>.
      const teamFilter: PropertyFilter = {
        type: "property",
        propertyId: core.prop(def.db, "team"),
        propertyType: "multi_select",
        operator: "enum_contains",
        value: [t.name],
      }
      notion.database({
        resourceId: team.linked(t.key, def.db),
        parent: at(team.page(t.key, def.db)),
        name: title,
        views: def.tabs.map((tab, index): ViewSchema => {
          const { key, filters, ...shape } = tab
          // Every row on a team page has that team, so cards don't repeat it.
          if (shape.type === "board" && shape.properties) {
            shape.properties = shape.properties.filter(prop => prop.property !== core.prop(def.db, "team"))
          }
          return {
            ...shape,
            // The first tab keeps the ID of the single team view the template
            // had before, so an existing build's tab is updated, not orphaned.
            resourceId: index === 0 ? team.view(t.key, def.db) : `${team.view(t.key, def.db)}-${key}`,
            dataSourceResourceId: core.ds(def.db),
            filters: saved([teamFilter, ...(filters ?? [])]),
          }
        }),
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
    const teamDs = database.getDataSource(teamDb.ds(d.key))
    addRow[teamDb.ds(d.key)] = args => void teamDs.addPage(args as any)

    database.addView({
      resourceId: teamDb.view(d.key),
      name: `All ${d.name.toLowerCase()}`,
      type: "table",
      dataSourceResourceId: teamDb.ds(d.key),
      sorts: [{ propertyId: teamDb.title(d.key), direction: "ascending" }],
    })
  }

  // -------------------------------------------------------------------------
  // Sample records (spec.sampleRecords)
  // -------------------------------------------------------------------------

  // Relation values are written on one side only: the "many" side (Tasks,
  // Meeting Notes and Docs → Project, Meeting Notes → Action Items). A
  // re-deploy clears two-way relation values (finding 18), so deploy sample
  // records once, on the first deploy.
  if (spec.sampleRecords) {
    const base = new Date(`${spec.engagement.signedOffOn}T00:00:00Z`)
    const day = (offset: number) => {
      const d = new Date(base.getTime() + offset * 86_400_000)
      return d.toISOString().slice(0, 10)
    }
    const names = spec.teams.map(t => t.name)
    /** The i-th team, cycling; no Team value if the spec has no teams. */
    const teamOf = (i: number) => notion.multiSelect(names.length > 0 ? [names[i % names.length]!] : [])
    const row = (db: CoreDatabase, n: number) => `${prefix}-s-${slugOf[db]}-${n}`

    /** A plausible value for a spec-defined property, or undefined to leave it empty. */
    const sampleValue = (prop: PropertySpec, i: number): any => {
      switch (prop.type) {
        case "text": return notion.text(`Example ${prop.name.toLowerCase()}`)
        case "number": return notion.number(1000 * (i + 1))
        case "select":
        case "status": return prop.options?.[i % prop.options.length]
        case "multi_select": return notion.multiSelect(prop.options ? [prop.options[i % prop.options.length]!] : [])
        case "date": return notion.date(day(30 * (i + 1)))
        case "checkbox": return notion.checkbox(i === 0)
        case "url": return notion.url("https://example.com")
        case "email": return notion.email("hello@example.com")
        case "phone_number": return notion.phone("+65 6000 0000")
        case "relation":
          return typeof prop.relationTo === "string" ? notion.relation([row(prop.relationTo, 1)]) : undefined
        default: return undefined // person values can't be set (finding 5)
      }
    }
    const extraValues = (db: CoreDatabase, i: number) =>
      Object.fromEntries(
        (spec.coreDatabases[db]?.addProperties ?? [])
          .map(prop => [prop.name, sampleValue(prop, i)] as const)
          .filter(([, value]) => value !== undefined)
      )

    const projects = [
      { name: "Website refresh", icon: "🌐", status: "In progress", priority: "High", start: -14, end: 45, summary: "Rebuild the company website on the new brand." },
      { name: "Quarterly planning", icon: "🗓️", status: "Not started", priority: "Medium", start: 21, end: 35, summary: "Agree next quarter's goals and owners." },
      { name: "Team onboarding guide", icon: "🧭", status: "Done", priority: "Low", start: -60, end: -10, summary: "One place for everything a new starter needs." },
    ]
    projects.forEach((pj, i) => {
      addRow[core.ds("projects")]!({
        resourceId: row("projects", i + 1),
        icon: { type: "emoji", emoji: pj.icon },
        properties: {
          Name: notion.text(pj.name),
          // The first project is cross-team, to show the multi-select.
          Team: i === 0 && names.length > 1 ? notion.multiSelect(names) : teamOf(i),
          Status: notion.status(pj.status),
          Priority: notion.select(pj.priority),
          Dates: notion.date(day(pj.start), day(pj.end)),
          Summary: notion.text(pj.summary),
          ...extraValues("projects", i),
        },
      })
    })

    const tasks = [
      { name: "Write the new homepage copy", project: 1, status: "In progress", priority: "High", due: 3 },
      { name: "Review the site map", project: 1, status: "Not started", priority: "Medium", due: 10 },
      { name: "Collect each team's goals", project: 2, status: "Not started", priority: "Medium", due: 24 },
      { name: "Book the planning workshop", project: 2, status: "Not started", priority: "Low", due: 18 },
      { name: "Draft the onboarding checklist", project: 3, status: "Done", priority: "Medium", due: -20 },
      { name: "Retire the old wiki page", project: 3, status: "Cancelled", priority: "Low", due: -12 },
    ]
    tasks.forEach((tk, i) => {
      addRow[core.ds("tasks")]!({
        resourceId: row("tasks", i + 1),
        properties: {
          Name: notion.text(tk.name),
          Team: teamOf(tk.project - 1),
          Status: notion.status(tk.status),
          Priority: notion.select(tk.priority),
          Due: notion.date(day(tk.due)),
          Project: notion.relation([row("projects", tk.project)]),
          ...extraValues("tasks", i),
        },
      })
    })

    const meetings = [
      { name: "Website refresh kick-off", type: "Team", date: -13, project: 1, actions: [1, 2] },
      { name: "Planning prep", type: "1:1", date: -2, project: 2, actions: [3, 4] },
      { name: "Monthly all-hands", type: "All-hands", date: -7, project: undefined, actions: [] },
    ]
    meetings.forEach((mt, i) => {
      addRow[core.ds("meetingNotes")]!({
        resourceId: row("meetingNotes", i + 1),
        properties: {
          Name: notion.text(mt.name),
          Team: teamOf(i),
          Type: notion.select(mt.type),
          Date: notion.date(day(mt.date)),
          ...(mt.project ? { Project: notion.relation([row("projects", mt.project)]) } : {}),
          ...(mt.actions.length > 0
            ? { "Action Items": notion.relation(mt.actions.map(n => row("tasks", n))) }
            : {}),
          ...extraValues("meetingNotes", i),
        },
        content: "# Notes\n\n- Example notes. Replace with your own.\n\n# Decisions\n\n- Example decision.\n",
      })
    })

    const docs = [
      { name: "Expenses policy", type: "Policy", reviewed: -30, project: undefined },
      { name: "How we run projects", type: "Guide", reviewed: -5, project: 1 },
      { name: "Brand guidelines", type: "Reference", reviewed: -90, project: 1 },
    ]
    docs.forEach((dc, i) => {
      addRow[core.ds("docs")]!({
        resourceId: row("docs", i + 1),
        properties: {
          Name: notion.text(dc.name),
          Team: teamOf(i),
          Type: notion.select(dc.type),
          "Last reviewed": notion.date(day(dc.reviewed)),
          ...(dc.project ? { Project: notion.relation([row("projects", dc.project)]) } : {}),
          ...extraValues("docs", i),
        },
        content: "Example content. Replace with your own.\n",
      })
    })

    for (const d of spec.teamDatabases) {
      for (const i of [0, 1]) {
        addRow[teamDb.ds(d.key)]!({
          resourceId: `${prefix}-s-tdb-${d.key}-${i + 1}`,
          properties: {
            Name: notion.text(`Example ${i + 1}`),
            ...Object.fromEntries(
              d.properties
                .map(prop => [prop.name, sampleValue(prop, i)] as const)
                .filter(([, value]) => value !== undefined)
            ),
          },
        })
      }
    }
  }
}
// </template>

export { buildWorkspace }
