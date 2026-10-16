/**
 * Dry-run validator: compiles a build's script to intents WITHOUT submitting
 * anything to Notion, then sanity-checks the resource graph.
 *
 * Usage (from the repo root):
 *   npm run check            # every build, plus cross-build collision checks
 *   npm run check -- crm     # one build
 */
import { compileNotionAsCodeScriptToIntents } from "../notion-sdk-js/src/EXPERIMENTAL__notion-as-code/utils/compile"
import { Build, findPrefixCollisions, listBuildNames, loadBuild } from "./builds"
import { compileWithNtnRuntime } from "./ntn"

type BuildCheck = {
  build: Build
  counts: Record<string, number>
  resourceIds: Set<string>
}

/** Every resourceId a script claims: intents, data sources and properties. */
function collectResourceIds(intents: any[]): {
  resourceIds: Set<string>
  duplicates: string[]
  counts: Record<string, number>
} {
  const counts: Record<string, number> = {}
  const resourceIds = new Set<string>()
  const duplicates: string[] = []

  const claim = (id: string | undefined) => {
    if (!id) return
    if (resourceIds.has(id)) duplicates.push(id)
    resourceIds.add(id)
  }

  for (const intent of intents) {
    counts[intent.type] = (counts[intent.type] ?? 0) + 1
    claim(
      intent.type === "view"
        ? intent.view.resourceId
        : "resourceId" in intent
          ? intent.resourceId
          : undefined
    )
    if (intent.type === "database") {
      for (const ds of intent.dataSources ?? []) {
        for (const prop of ds.properties) claim(prop.resourceId)
        claim(ds.resourceId)
      }
      // Views declared inline on a (linked) database intent
      for (const view of intent.views ?? []) claim(view.resourceId)
    }
    if (intent.type === "database_automation") {
      for (const action of intent.actions ?? []) claim(action.resourceId)
    }
  }
  return { resourceIds, duplicates, counts }
}

async function checkBuild(name: string): Promise<BuildCheck> {
  const build = loadBuild(name)
  const intents =
    build.manifest.engine === "ntn"
      ? compileWithNtnRuntime(build.scriptPath)
      : await compileNotionAsCodeScriptToIntents({
          filePathToScript: build.scriptPath,
        })
  const { resourceIds, duplicates, counts } = collectResourceIds(intents)

  console.log(`\n▸ ${name} — ${build.manifest.title}`)
  if (build.manifest.engine === "ntn") console.log(`  engine: ntn (vendor/ntn-template)`)
  console.log(`  intents: ${JSON.stringify(counts)}`)
  console.log(`  unique resourceIds: ${resourceIds.size}`)
  if (duplicates.length > 0) {
    console.error(`  ✗ DUPLICATE resourceIds: ${duplicates.join(", ")}`)
    process.exitCode = 1
  } else {
    console.log(`  ✓ resourceIds unique within build`)
  }
  return { build, counts, resourceIds }
}

async function main() {
  const requested = process.argv.slice(2).filter(arg => !arg.startsWith("-"))
  const names = requested.length > 0 ? requested : listBuildNames()

  const checks: BuildCheck[] = []
  for (const name of names) checks.push(await checkBuild(name))

  // Cross-build safety. Session state is keyed by resourceId, so two builds
  // sharing one can collide in a shared workspace. This is checked rather than
  // prevented by a naming convention, because renaming a DEPLOYED build's
  // resourceIds would orphan its session mappings and duplicate the build.
  if (checks.length > 1) {
    console.log(`\n▸ cross-build checks (${checks.length} builds)`)
    const seen = new Map<string, string>()
    const collisions: string[] = []
    for (const check of checks) {
      for (const id of check.resourceIds) {
        const owner = seen.get(id)
        if (owner) {
          collisions.push(`${id} (${owner} ↔ ${check.build.manifest.name})`)
        } else {
          seen.set(id, check.build.manifest.name)
        }
      }
    }
    if (collisions.length > 0) {
      console.error(`  ✗ resourceIds claimed by more than one build:`)
      for (const collision of collisions) console.error(`      ${collision}`)
      process.exitCode = 1
    } else {
      console.log(`  ✓ no resourceId claimed by two builds`)
    }

    const prefixCollisions = findPrefixCollisions(checks.map(check => check.build))
    if (prefixCollisions.length > 0) {
      console.error(`  ✗ auto-increment prefixes claimed twice in one workspace:`)
      for (const { prefix, builds } of prefixCollisions) {
        console.error(`      ${prefix} (${builds.join(", ")})`)
      }
      process.exitCode = 1
    } else {
      console.log(`  ✓ no auto-increment prefix claimed twice per workspace`)
    }
  }

  if (process.exitCode === 1) {
    console.error(`\nFAILED`)
    return
  }
  console.log(`\nOK: ${names.length} build(s) compiled and checked.`)
}

main().catch(error => {
  console.error("Compile check failed:", error.message ?? error)
  process.exit(1)
})
