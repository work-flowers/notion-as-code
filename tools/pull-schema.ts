/**
 * Extracts an existing Notion database's schema AND view configuration into a
 * build's source/ directory, so a build modelled on a live workspace can be
 * re-derived without re-discovering the API surface.
 *
 * There is no pull/import in Notion as Code (see docs/FINDINGS.md #16), so this
 * is the closest thing: it dumps what the REST API exposes and writes a compact
 * human-readable summary next to the raw JSON.
 *
 * Usage (from the repo root):
 *   npm run pull -- --database=31a91b0711ac801fa4abec043bc3172f --out=builds/crm/source
 *
 * Notes on the API surface (2026-03-11):
 *   - views are undocumented but real: GET /v1/views?data_source_id=… then
 *     GET /v1/views/{id}
 *   - GET /v1/views/{id} 400s on feed views ("Unsupported view type: feed")
 *   - retrieved filters come back null when the filter uses a relative date or
 *     the `me` variable, so such views read as unfiltered
 */
import { execFileSync } from "child_process"
import * as fs from "fs"
import * as path from "path"
import { REPO_ROOT } from "./builds"

const NOTION_VERSION = "2026-03-11"
const DEFAULT_TOKEN_REF = "op://Employee/notion-as-code/credential"
const DEFAULT_OP_ACCOUNT = "work-flowers"

function arg(name: string): string | undefined {
  const hit = process.argv.slice(2).find(a => a.startsWith(`--${name}=`))
  return hit?.split("=").slice(1).join("=")
}

function token(): string {
  const fromEnv = process.env["NOTION_TOKEN"]
  if (fromEnv) return fromEnv
  const ref = arg("tokenRef") ?? DEFAULT_TOKEN_REF
  const account = arg("opAccount") ?? DEFAULT_OP_ACCOUNT
  return execFileSync("op", ["read", ref, "--account", account], {
    encoding: "utf8",
  }).trim()
}

const auth = token()

async function api<T = any>(pathAndQuery: string): Promise<T> {
  const response = await fetch(`https://api.notion.com/v1/${pathAndQuery}`, {
    headers: {
      Authorization: `Bearer ${auth}`,
      "Notion-Version": NOTION_VERSION,
    },
  })
  return (await response.json()) as T
}

const plain = (rich: any): string =>
  Array.isArray(rich) ? rich.map((t: any) => t.plain_text ?? "").join("") : (rich ?? "")

/** One line per property: type plus whatever detail that type carries. */
function describeProperty(name: string, prop: any, dsNames: Map<string, string>): string {
  const type = prop.type
  let extra = ""
  if (type === "select" || type === "multi_select" || type === "status") {
    const config = prop[type]
    const options = (config.options ?? []).map((o: any) => `${o.name}/${o.color}`)
    extra = ` [${options.length}] ${JSON.stringify(options.slice(0, 30))}${
      options.length > 30 ? " …TRUNCATED" : ""
    }`
    if (type === "status") {
      const byId = new Map<string, string>(
        (config.options ?? []).map((o: any) => [o.id, o.name])
      )
      const groups = (config.groups ?? []).map(
        (g: any) => `${g.name}:[${g.option_ids.map((id: string) => byId.get(id)).join(", ")}]`
      )
      extra += ` GROUPS ${groups.join(" ")}`
    }
  } else if (type === "relation") {
    const target = prop.relation.data_source_id ?? prop.relation.database_id
    extra =
      ` -> ${dsNames.get(target) ?? target} (${prop.relation.type})` +
      (prop.relation.dual_property
        ? ` synced=${prop.relation.dual_property.synced_property_name}`
        : "")
  } else if (type === "rollup") {
    const r = prop.rollup
    extra = ` rel=${r.relation_property_name} target=${r.rollup_property_name} fn=${r.function}`
  } else if (type === "formula") {
    extra = ` expr=${prop.formula.expression}`
  } else if (type === "unique_id") {
    extra = ` prefix=${prop.unique_id.prefix}`
  } else if (type === "number") {
    extra = ` format=${prop.number.format}`
  }
  return `  - ${JSON.stringify(name)}: ${type}${extra}`
}

function describeView(view: any, dsNames: Map<string, string>): string {
  const config = view.configuration ?? {}
  const lines = [
    `\n## [${dsNames.get(view.data_source_id) ?? view.data_source_id}] ${JSON.stringify(
      view.name
    )}  type=${view.type}  db=${view.parent?.database_id}`,
    `   filter: ${view.filter ? JSON.stringify(view.filter) : "none (or unsupported: relative date / me)"}`,
  ]
  if (view.sorts?.length) {
    lines.push(
      `   sorts: ${view.sorts
        .map((s: any) => `${s.property_name ?? s.property} ${s.direction}`)
        .join(", ")}`
    )
  }
  for (const key of Object.keys(config)) {
    if (key === "properties" || key === "type") continue
    lines.push(`   ${key}: ${JSON.stringify(config[key])}`)
  }
  const visible = (config.properties ?? [])
    .filter((p: any) => p.visible)
    .map((p: any) => p.property_name)
  if (visible.length) lines.push(`   visible: ${JSON.stringify(visible)}`)
  return lines.join("\n")
}

async function main() {
  const databaseId = arg("database")
  const out = arg("out")
  if (!databaseId || !out) {
    console.error(
      "Usage: npm run pull -- --database=<databaseId> --out=builds/<name>/source"
    )
    process.exit(1)
  }
  const outDir = path.isAbsolute(out) ? out : path.join(REPO_ROOT, out)
  const rawDir = path.join(outDir, "raw")
  fs.mkdirSync(path.join(rawDir, "views"), { recursive: true })

  const database = await api(`databases/${databaseId}`)
  if (database.object === "error") throw new Error(JSON.stringify(database))
  fs.writeFileSync(
    path.join(rawDir, `database-${databaseId}.json`),
    JSON.stringify(database, null, 2)
  )
  console.log(`database: ${plain(database.title)} (${database.data_sources.length} data source(s))`)

  const dataSources: any[] = []
  for (const stub of database.data_sources) {
    const ds = await api(`data_sources/${stub.id}`)
    dataSources.push(ds)
    fs.writeFileSync(
      path.join(rawDir, `data_source-${stub.id}.json`),
      JSON.stringify(ds, null, 2)
    )
    console.log(`  data source: ${stub.name} (${Object.keys(ds.properties).length} properties)`)
  }
  const dsNames = new Map<string, string>(
    dataSources.map(ds => [ds.id, plain(ds.name) || ds.id])
  )

  // Schema summary
  const schemaLines: string[] = []
  for (const ds of dataSources) {
    schemaLines.push(
      `\n${"=".repeat(70)}\nDS: ${dsNames.get(ds.id)}  (${ds.id})  desc=${plain(
        ds.description
      ).slice(0, 200)}`
    )
    for (const [name, prop] of Object.entries<any>(ds.properties)) {
      schemaLines.push(describeProperty(name, prop, dsNames))
    }
  }
  fs.writeFileSync(path.join(outDir, "schema.txt"), schemaLines.join("\n") + "\n")

  // Views: list per data source, then retrieve each
  const viewLines: string[] = []
  const unreadable: string[] = []
  for (const ds of dataSources) {
    const list = await api(`views?data_source_id=${ds.id}&page_size=100`)
    const ids: string[] = (list.results ?? []).map((v: any) => v.id)
    console.log(`  views on ${dsNames.get(ds.id)}: ${ids.length}`)
    for (const id of ids) {
      const view = await api(`views/${id}`)
      if (view.object !== "view") {
        unreadable.push(`${id}: ${view.message ?? "unreadable"}`)
        continue
      }
      fs.writeFileSync(
        path.join(rawDir, "views", `${id}.json`),
        JSON.stringify(view, null, 2)
      )
      viewLines.push(describeView(view, dsNames))
    }
  }
  if (unreadable.length) {
    viewLines.push(
      `\n${"=".repeat(70)}\nUNREADABLE VIEWS (${unreadable.length}) — the API cannot ` +
        `retrieve these (e.g. feed views):\n` +
        unreadable.map(u => `  ${u}`).join("\n")
    )
  }
  fs.writeFileSync(path.join(outDir, "views.txt"), viewLines.join("\n") + "\n")

  console.log(
    `\nWrote ${outDir}/schema.txt, ${outDir}/views.txt and raw JSON under ${rawDir}/` +
      (unreadable.length ? `\n${unreadable.length} view(s) could not be retrieved.` : "")
  )
}

main().catch(error => {
  console.error("Pull failed:", error.message ?? error)
  process.exit(1)
})
