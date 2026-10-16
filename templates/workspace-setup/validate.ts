/**
 * Checks a WorkspaceSpec for what its type can't catch, before a build is
 * generated. Returns every problem at once, so one pass over the spec doc
 * fixes them all.
 */
import type { CoreDatabase, PropertySpec, WorkspaceSpec } from "./spec"

const CORE_DATABASES: Record<CoreDatabase, string> = {
  projects: "Projects",
  tasks: "Tasks",
  meetingNotes: "Meeting Notes",
  docs: "Docs",
}

/** Names the template already gives each core database. Keep in step with template.ts. */
const STANDARD_PROPERTY_NAMES: Record<CoreDatabase, string[]> = {
  projects: ["Name", "Team", "Status", "Owner", "Dates", "Priority", "Summary", "Tasks", "Meeting Notes", "Docs"],
  tasks: ["Name", "Team", "Status", "Assignee", "Due", "Priority", "Project", "Meeting"],
  meetingNotes: ["Name", "Team", "Date", "Type", "Attendees", "Project", "Action Items"],
  docs: ["Name", "Team", "Type", "Owner", "Last reviewed", "Project"],
}

const KEY = /^[a-z0-9]+(-[a-z0-9]+)*$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const OPTION_TYPES = new Set(["select", "multi_select", "status"])

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

function duplicates(values: string[]): string[] {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const value of values.map(v => v.trim().toLowerCase())) {
    if (seen.has(value)) dupes.add(value)
    seen.add(value)
  }
  return [...dupes]
}

export function validateSpec(spec: WorkspaceSpec): string[] {
  const errors: string[] = []
  const teamKeys = new Set(spec.teams.map(t => t.key))
  const teamDbKeys = new Set(spec.teamDatabases.map(d => d.key))

  // §1 Engagement
  if (!UUID.test(spec.engagement.workspaceId)) {
    errors.push(`engagement.workspaceId "${spec.engagement.workspaceId}" is not a workspace UUID`)
  }
  if (!ISO_DATE.test(spec.engagement.signedOffOn)) {
    errors.push(`engagement.signedOffOn must be the ISO sign-off date (YYYY-MM-DD); got "${spec.engagement.signedOffOn}"`)
  }

  // §9 Add-ons
  if (spec.addOns.crm) errors.push("CRM add-on not yet supported")

  // §3 Teams
  for (const key of duplicates(spec.teams.map(t => t.key))) errors.push(`duplicate team key "${key}"`)
  for (const name of duplicates(spec.teams.map(t => t.name))) errors.push(`duplicate team name "${name}"`)
  for (const t of spec.teams) {
    if (!KEY.test(t.key)) errors.push(`team key "${t.key}" must be lowercase letters, digits and hyphens`)
    if (t.name.includes(",")) errors.push(`team "${t.key}": name can't contain a comma (it's a multi-select option)`)
    if (same(t.name, spec.companyTeamspace.name)) {
      errors.push(`team "${t.key}" has the same name as the company teamspace ("${t.name}")`)
    }
  }

  const checkProperties = (where: string, props: PropertySpec[], reserved: string[]) => {
    for (const key of duplicates(props.map(p => p.key))) errors.push(`${where}: duplicate property key "${key}"`)
    for (const name of duplicates(props.map(p => p.name))) errors.push(`${where}: duplicate property name "${name}"`)
    for (const prop of props) {
      const at = `${where} property "${prop.key}"`
      if (!KEY.test(prop.key)) errors.push(`${at}: key must be lowercase letters, digits and hyphens`)
      const clash = reserved.find(name => same(name, prop.name))
      if (clash) errors.push(`${at}: name "${prop.name}" is already a standard property`)

      if (OPTION_TYPES.has(prop.type)) {
        const options = prop.options ?? []
        if (options.length === 0) errors.push(`${at}: ${prop.type} needs options`)
        if (prop.type === "status" && options.length > 0 && options.length < 3) {
          errors.push(`${at}: status needs at least 3 options (to do, in progress…, complete)`)
        }
        for (const option of duplicates(options)) errors.push(`${at}: duplicate option "${option}"`)
      } else if (prop.options) {
        errors.push(`${at}: options are only allowed on select, multi_select and status`)
      }

      if (prop.type === "relation") {
        const target = prop.relationTo
        if (!target) {
          errors.push(`${at}: relation needs relationTo`)
        } else if (typeof target === "string") {
          if (!(target in CORE_DATABASES)) errors.push(`${at}: unknown relation target "${target}"`)
        } else if (!teamDbKeys.has(target.teamDatabase)) {
          errors.push(`${at}: unknown relation target team database "${target.teamDatabase}"`)
        }
      } else if (prop.relationTo) {
        errors.push(`${at}: relationTo is only allowed on relation properties`)
      }
    }
  }

  // §4 Core database changes
  for (const [db, changes] of Object.entries(spec.coreDatabases)) {
    if (!(db in CORE_DATABASES)) {
      errors.push(`coreDatabases: unknown core database "${db}"`)
      continue
    }
    const coreDb = db as CoreDatabase
    checkProperties(`coreDatabases.${db}`, changes?.addProperties ?? [], STANDARD_PROPERTY_NAMES[coreDb])
  }

  // §5 Team databases
  for (const key of duplicates(spec.teamDatabases.map(d => d.key))) errors.push(`duplicate team database key "${key}"`)
  for (const name of duplicates(spec.teamDatabases.map(d => d.name))) errors.push(`duplicate team database name "${name}"`)
  for (const d of spec.teamDatabases) {
    const at = `team database "${d.key}"`
    if (!KEY.test(d.key)) errors.push(`${at}: key must be lowercase letters, digits and hyphens`)
    if (!teamKeys.has(d.team)) errors.push(`${at}: owned by unknown team "${d.team}"`)
    const coreName = Object.values(CORE_DATABASES).find(name =>
      new RegExp(`\\b${name}\\b`, "i").test(d.name)
    )
    if (coreName) errors.push(`${at}: name "${d.name}" reuses the core database name "${coreName}"`)
    checkProperties(at, d.properties, ["Name"])
  }

  // §6 Home pages
  for (const key of Object.keys(spec.homePages.teams ?? {})) {
    if (!teamKeys.has(key)) errors.push(`homePages.teams: unknown team "${key}"`)
  }

  return errors
}
