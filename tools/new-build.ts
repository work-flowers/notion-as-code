/**
 * Generates a client build from a WorkspaceSpec and the core template
 * (templates/workspace-setup).
 *
 * Usage (from the repo root):
 *   npm run new-build -- <name> --prefix <p> [--spec <path>]
 *
 * --spec defaults to builds/<name>/spec.ts. A spec elsewhere is copied there,
 * so builds/<name>/ ends up a complete record of what was deployed:
 *   spec.ts       the client's spec (input)
 *   build.ts      spec types + spec + template, self-contained (build scripts
 *                 can't import other files)
 *   build.json    manifest, status not-deployed, "engine": "ntn"
 *   session.json  seeded with the workspace anchor only
 *
 * Builds run on the ntn engine (finding 25): they compile and type-check
 * against vendor/ntn-template and deploy through `ntn notion-as-code apply`.
 * The template's team-view filters rely on it (finding 27, 30).
 *
 * --prefix starts every resourceId (e.g. "acme" → "acme-projects-db"). Keep it
 * short and unique per workspace, and never change it after a deploy.
 *
 * Regenerating is allowed until the first deploy. After that the generator
 * refuses: a deployed build's script is a record, and the client workspace is
 * retired from Notion as Code at the cut-off (docs/GUARDRAILS.md).
 *
 * --force regenerates a deployed build, but only while every one of its
 * databases is empty (checked through the API), because a re-deploy clears
 * relation values on existing rows (finding 18). It keeps session.json and the
 * deploy fields in build.json. Never for a retired or removed build.
 *
 * --allow-rows (with --force) skips the empty check. It's for testing
 * re-deploys on a demo build, never for a client workspace.
 */
import * as fs from "fs"
import * as path from "path"
import { BUILDS_DIR, BuildManifest, loadAllBuilds, readToken, REPO_ROOT } from "./builds"
import type { WorkspaceSpec } from "../templates/workspace-setup/spec"
import { validateSpec } from "../templates/workspace-setup/validate"

const TEMPLATE_DIR = path.join(REPO_ROOT, "templates/workspace-setup")
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/
const PREFIX = /^[a-z][a-z0-9]{1,7}$/

function fail(message: string): never {
  console.error(`\n✗ ${message}`)
  process.exit(1)
}

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(`--${name}`)
  return index >= 0 ? args[index + 1] : undefined
}

/** The text between `// <marker>` and `// </marker>`, with `export` dropped. */
function region(file: string, marker: string): string {
  const source = fs.readFileSync(file, "utf8")
  const match = source.match(new RegExp(`// <${marker}>\\n([\\s\\S]*?)// </${marker}>`))
  if (!match) fail(`No <${marker}> region in ${path.relative(REPO_ROOT, file)}`)
  return match[1]!.replace(/^export /gm, "").trimEnd()
}

/** Copies a spec into the build dir, re-pointing its relative imports. */
function copySpec(from: string, to: string) {
  const source = fs.readFileSync(from, "utf8").replace(
    /(from\s+["'])(\.{1,2}\/[^"']+)(["'])/g,
    (_, open: string, specifier: string, close: string) => {
      let relative = path.relative(path.dirname(to), path.resolve(path.dirname(from), specifier))
      if (!relative.startsWith(".")) relative = `./${relative}`
      return `${open}${relative}${close}`
    }
  )
  fs.writeFileSync(to, source)
}

/**
 * A session file's resource pointers, in either shape: the SDK runner's
 * resourceIdToPointerMappings (`table`) or ntn's resourceIdToResourcePointers
 * (`type`, finding 26).
 */
function sessionPointers(sessionPath: string): Record<string, { kind: string; id: string }> {
  const session = JSON.parse(fs.readFileSync(sessionPath, "utf8"))
  const raw = session.resourceIdToPointerMappings ?? session.resourceIdToResourcePointers ?? {}
  return Object.fromEntries(
    Object.entries<any>(raw).map(([resourceId, pointer]) => [
      resourceId,
      { kind: pointer.table ?? pointer.type, id: pointer.id },
    ])
  )
}

/** Data sources in a session file that already hold rows. */
async function dataSourcesWithRows(sessionPath: string, token: string): Promise<string[]> {
  const withRows: string[] = []
  for (const [resourceId, pointer] of Object.entries(sessionPointers(sessionPath))) {
    if (pointer.kind !== "collection") continue
    const res = await fetch(`https://api.notion.com/v1/data_sources/${pointer.id}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2026-03-11",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ page_size: 1 }),
    })
    const body = await res.json()
    if (!res.ok) throw new Error(`Couldn't query ${resourceId}: ${body.message}`)
    if (body.results.length > 0) withRows.push(resourceId)
  }
  return withRows
}

function teamspaceSummary(spec: WorkspaceSpec): string {
  return [
    `${spec.companyTeamspace.name} (default)`,
    ...spec.teams.map(t => `${t.name} (${t.access})`),
  ].join(", ")
}

async function main() {
  const args = process.argv.slice(2)
  const name = args.find((arg, i) => !arg.startsWith("-") && !args[i - 1]?.startsWith("--"))
  if (!name) fail("Usage: npm run new-build -- <name> --prefix <p> [--spec <path>]")
  if (!NAME.test(name)) fail(`Build name "${name}" must be lowercase letters, digits and hyphens.`)

  const dir = path.join(BUILDS_DIR, name)
  const manifestPath = path.join(dir, "build.json")
  const sessionPath = path.join(dir, "session.json")
  const specPath = path.join(dir, "spec.ts")
  const existing = fs.existsSync(manifestPath)
    ? (JSON.parse(fs.readFileSync(manifestPath, "utf8")) as BuildManifest & { prefix?: string })
    : undefined

  // Never regenerate over a deployed build, unless --force and it's empty.
  const force = args.includes("--force")
  const deployed =
    (existing && existing.status !== "not-deployed") ||
    (fs.existsSync(sessionPath) && Object.keys(sessionPointers(sessionPath)).length > 1)
  if (deployed) {
    if (!force) {
      fail(`builds/${name} is deployed. Its script is a record now; don't regenerate it.`)
    }
    if (existing?.status === "retired" || existing?.status === "removed") {
      fail(`builds/${name} is ${existing.status}. --force doesn't apply.`)
    }
    const token = readToken(existing?.tokenRef, existing?.opAccount)
    const withRows = await dataSourcesWithRows(sessionPath, token)
    if (withRows.length > 0 && !args.includes("--allow-rows")) {
      fail(
        `--force refused: ${withRows.join(", ")} already hold rows, and a re-deploy ` +
          `would clear their relation values (finding 18). Add --allow-rows only to ` +
          `test that on a demo build.`
      )
    }
    console.log(
      withRows.length > 0
        ? `--force --allow-rows: ${withRows.join(", ")} hold rows. A re-deploy may clear their relation values.`
        : `--force: builds/${name} is deployed but every database is empty; regenerating.`
    )
  }

  const prefix = flag(args, "prefix") ?? existing?.prefix
  if (!prefix) fail("--prefix is required (e.g. --prefix acme).")
  if (!PREFIX.test(prefix)) fail(`Prefix "${prefix}" must be 2–8 lowercase letters/digits, starting with a letter.`)
  if (existing?.prefix && existing.prefix !== prefix) {
    fail(`builds/${name} was generated with prefix "${existing.prefix}". Keep it.`)
  }
  const prefixOwner = loadAllBuilds().find(
    build => build.manifest.name !== name && (build.manifest as { prefix?: string }).prefix === prefix
  )
  if (prefixOwner) fail(`Prefix "${prefix}" is already used by builds/${prefixOwner.manifest.name}.`)

  // Load and validate the spec.
  const sourceSpec = path.resolve(flag(args, "spec") ?? specPath)
  if (!fs.existsSync(sourceSpec)) fail(`Spec not found: ${sourceSpec}`)
  const spec = (await import(sourceSpec)).default as WorkspaceSpec
  if (!spec?.engagement) fail(`${sourceSpec} has no default-exported WorkspaceSpec.`)
  const errors = validateSpec(spec)
  if (errors.length > 0) {
    fail(`The spec has ${errors.length} problem(s):\n${errors.map(e => `    - ${e}`).join("\n")}`)
  }

  fs.mkdirSync(dir, { recursive: true })
  if (sourceSpec !== specPath) copySpec(sourceSpec, specPath)

  const spaceAnchor = `${prefix}-space`
  const script = `/**
 * ${name} — ${spec.engagement.client} workspace, from the workFlowers core template.
 *
 * GENERATED by \`npm run new-build -- ${name} --prefix ${prefix}\` from spec.ts.
 * Don't edit by hand: change spec.ts (or the template) and regenerate. After
 * the first deploy this file is a record of what was deployed.
 *
 * Spec doc:   ${spec.engagement.specDocUrl}
 * Signed off: ${spec.engagement.signedOffOn}
 * Template:   templates/workspace-setup/template.ts (TKT-978)
 */

// ---------------------------------------------------------------------------
// WorkspaceSpec types (templates/workspace-setup/spec.ts)
// ---------------------------------------------------------------------------

${region(path.join(TEMPLATE_DIR, "spec.ts"), "spec-types")}

// ---------------------------------------------------------------------------
// Spec (spec.ts)
// ---------------------------------------------------------------------------

const spec: WorkspaceSpec = ${JSON.stringify(spec, null, 2)}

// ---------------------------------------------------------------------------
// Template (templates/workspace-setup/template.ts)
// ---------------------------------------------------------------------------

${region(path.join(TEMPLATE_DIR, "template.ts"), "template")}

buildWorkspace(spec, ${JSON.stringify(prefix)}, ${JSON.stringify(spaceAnchor)})

export {}
`
  fs.writeFileSync(path.join(dir, "build.ts"), script)

  // Reuse the token of another build in the same workspace, if there is one.
  const sibling = loadAllBuilds().find(
    build => build.manifest.name !== name && build.manifest.spaceId === spec.engagement.workspaceId
  )
  const manifest = {
    name,
    title: `${spec.engagement.client} workspace (core template)`,
    spaceId: spec.engagement.workspaceId,
    spaceAnchorResourceId: spaceAnchor,
    script: "build.ts",
    session: "session.json",
    spec: "spec.ts",
    engine: "ntn",
    prefix,
    tokenRef: existing?.tokenRef ?? sibling?.manifest.tokenRef,
    opAccount: existing?.opAccount ?? sibling?.manifest.opAccount,
    autoIncrementPrefixes: [],
    status: deployed ? existing!.status : "not-deployed",
    deployedAt: deployed ? existing!.deployedAt : null,
    teamspace: teamspaceSummary(spec),
    hubUrl: deployed ? existing!.hubUrl : null,
  }
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

  if (deployed) {
    console.log(`✓ builds/${name} regenerated; session.json kept`)
    console.log(`\nNext:  npm run check -- ${name} && npm run typecheck -- ${name} && npm run build -- ${name} --dry`)
    return
  }

  const session = {
    resourceIdToPointerMappings: {
      [spaceAnchor]: {
        table: "space",
        id: spec.engagement.workspaceId,
        spaceId: spec.engagement.workspaceId,
      },
    },
    resourceIdToPropertyIdMappings: {},
  }
  fs.writeFileSync(sessionPath, `${JSON.stringify(session, null, 2)}\n`)

  console.log(`✓ builds/${name} generated (${spec.teams.length} team(s), ${spec.teamDatabases.length} team database(s))`)
  if (!manifest.tokenRef) {
    console.log(`  ! no tokenRef: add one to build.json or export $NOTION_TOKEN before deploying`)
  }
  console.log(`\nNext:  npm run check -- ${name} && npm run typecheck -- ${name} && npm run build -- ${name} --dry`)
}

main().catch(error => fail(error.message ?? String(error)))
