/**
 * WorkspaceSpec — the machine-readable form of a client's signed-off spec doc.
 *
 * The client signs off the Notion doc "Template: Workspace Setup Spec" (one copy
 * per engagement). Claude converts it into builds/<client>/spec.ts, typed as
 * WorkspaceSpec, and the core template (TKT-978) builds from that. Each section
 * of this type maps 1:1 to a numbered section of the doc, so a gap in the doc
 * shows up as a type error before any deploy.
 *
 * Only what the doc lets the client choose is here. Everything fixed — the four
 * core databases, their standard properties and relations, the Team
 * multi-select, the team-view layout — lives in the template, not the spec.
 *
 * Keys (`key`) become resourceId fragments. Never change a key after the first
 * deploy: the next run would duplicate the resource (see AGENTS.md). In practice
 * the script is retired at the cut-off anyway (docs/GUARDRAILS.md).
 *
 * tools/new-build.ts copies everything between the <spec-types> markers into
 * each generated build.ts (minus `export`), so keep the types self-contained.
 */

// <spec-types>

/** Doc §1. Engagement details the build needs. */
export interface EngagementSpec {
  client: string
  /** Workspace ID of the client's Notion workspace (the deploy target). */
  workspaceId: string
  /** URL of the signed-off spec doc this file was converted from. */
  specDocUrl: string
  /** ISO date of client sign-off (doc §11). Required before a deploy. */
  signedOffOn: string
}

/** Notion's option colours (select, multi-select, status). */
export type OptionColor =
  | "default"
  | "gray"
  | "brown"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink"
  | "red"

/** Notion's icon colours. */
export type IconColor = Exclude<OptionColor, "default"> | "lightgray"

export type Icon =
  | { type: "emoji"; emoji: string }
  | { type: "notion_icon"; description: string; color?: IconColor }

/** Doc §3. The all-company teamspace is always created with `default` access. */
export interface CompanyTeamspaceSpec {
  name: string
  icon: Icon
  description?: string
}

/** Doc §3. Access for a team's teamspace. `default` is reserved for the company one. */
export type TeamAccess = "open" | "closed" | "private"

export interface TeamSpec {
  /** Short slug, lowercase, e.g. "ops". Never changed after deploy. */
  key: string
  /** Display name. Also the teamspace name and the Team multi-select option. */
  name: string
  access: TeamAccess
  icon: Icon
  /** Notion colour for the Team option. */
  color?: OptionColor
}

export type CoreDatabase = "meetingNotes" | "projects" | "tasks" | "docs"

/**
 * Property types a spec may ask for. Excludes what the script can't do
 * reliably: cross-database formulas (finding 1), number formats (finding 11),
 * buttons and place (finding 10). Those go in doc §7 as built-by-hand items.
 * Person columns can be created; person values can't be set (finding 5).
 */
export type SpecPropertyType =
  | "text"
  | "number"
  | "select"
  | "multi_select"
  | "status"
  | "date"
  | "checkbox"
  | "url"
  | "email"
  | "phone_number"
  | "person"
  | "relation"

export interface PropertySpec {
  /** Short slug, unique within its database. Never changed after deploy. */
  key: string
  name: string
  type: SpecPropertyType
  /**
   * Required for select, multi_select and status. For status, list at least
   * three in workflow order: the first is the default ("to do" group), the
   * last is the "complete" group, the rest are "in progress".
   */
  options?: string[]
  /** Required for relation: a core database or a team database key. Relations are one-way. */
  relationTo?: CoreDatabase | { teamDatabase: string }
  description?: string
}

/** Doc §4. Additions to a core database. Removing or renaming standard properties is a template change, not a spec item. */
export interface CoreDatabaseChanges {
  addProperties: PropertySpec[]
}

/** Doc §5. A database that belongs to one team, nested in that team's Home page. */
export interface TeamDatabaseSpec {
  key: string
  /** TeamSpec.key of the owning team. */
  team: string
  /** Named for what it holds, never a core database name. */
  name: string
  icon: Icon
  purpose: string
  properties: PropertySpec[]
}

/** Doc §6. Intro text for Home pages; the template adds the database links. */
export interface HomePagesSpec {
  company?: string
  /** Keyed by TeamSpec.key. */
  teams?: Record<string, string>
}

/** Doc §9. Add-ons decide which optional modules the template includes. */
export interface AddOnsSpec {
  crm: boolean
}

export interface WorkspaceSpec {
  engagement: EngagementSpec
  companyTeamspace: CompanyTeamspaceSpec
  teams: TeamSpec[]
  coreDatabases: Partial<Record<CoreDatabase, CoreDatabaseChanges>>
  teamDatabases: TeamDatabaseSpec[]
  homePages: HomePagesSpec
  addOns: AddOnsSpec
}

// </spec-types>

/** Identity helper so a spec file gets checked against WorkspaceSpec. */
export function defineSpec(spec: WorkspaceSpec): WorkspaceSpec {
  return spec
}
