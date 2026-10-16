/**
 * Deploys a build by name, resolving every path and ID from its build.json so
 * that script ↔ session ↔ workspace can never be mismatched by hand.
 *
 * Usage (from the repo root):
 *   npm run build -- crm            # deploy / re-deploy
 *   npm run build -- crm --dry      # print what would run, touch nothing
 *   npm run build                   # list builds
 *
 * The token comes from $NOTION_TOKEN if set, otherwise from the build's
 * `tokenRef` via the 1Password CLI. It is never printed and never passed on the
 * command line — only through the child process environment.
 */
import { spawnSync } from "child_process"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import {
  assertSessionMatchesManifest,
  findPrefixCollisions,
  listBuildNames,
  loadAllBuilds,
  loadBuild,
  readToken,
  SDK_DIR,
  type Build,
} from "./builds"
import { compileWithNtnRuntime } from "./ntn"

function main() {
  const args = process.argv.slice(2)
  const name = args.find(arg => !arg.startsWith("-"))
  const dryRun = args.includes("--dry")

  if (!name) {
    console.log("Builds in this repo:\n")
    for (const build of loadAllBuilds()) {
      const { manifest } = build
      const deployed =
        manifest.status === "deployed"
          ? `deployed ${manifest.deployedAt}`
          : manifest.status === "removed"
            ? `removed ${manifest.removedAt}`
            : manifest.status.replace("-", " ")
      console.log(`  ${manifest.name.padEnd(12)} ${deployed.padEnd(22)} ${manifest.title}`)
    }
    console.log("\nRun one with:  npm run build -- <name> [--dry]")
    return
  }

  const build = loadBuild(name)
  const { manifest } = build

  // Safety gates before anything reaches Notion.
  if (!dryRun && (manifest.status === "retired" || manifest.status === "removed")) {
    throw new Error(
      `${manifest.name} is ${manifest.status}. Its script is a record now; ` +
        `don't deploy it (docs/GUARDRAILS.md).`
    )
  }
  assertSessionMatchesManifest(build)
  const prefixCollisions = findPrefixCollisions(loadAllBuilds())
  if (prefixCollisions.length > 0) {
    throw new Error(
      `Auto-increment prefix collision in one workspace: ` +
        prefixCollisions
          .map(({ prefix, builds }) => `${prefix} (${builds.join(", ")})`)
          .join("; ")
    )
  }

  console.log(`build:     ${manifest.name} — ${manifest.title}`)
  console.log(`workspace: ${manifest.spaceId}`)
  console.log(`teamspace: ${manifest.teamspace}`)
  console.log(`script:    ${build.scriptPath}`)
  console.log(`session:   ${build.sessionPath} ✓ anchors ${manifest.spaceAnchorResourceId}`)
  console.log(`status:    ${manifest.status}`)

  if (manifest.engine === "ntn") {
    deployWithNtn(build, dryRun)
  } else {
    deployWithSdk(build, dryRun)
  }
  if (dryRun) return

  console.log(
    `\nDone. Commit the updated ${manifest.session}, and if this was a first ` +
      `deploy update status/deployedAt/hubUrl in ${manifest.name}/build.json.`
  )
}

/** Deploys through the notion-sdk-js checkout's runner (the default engine). */
function deployWithSdk(build: Build, dryRun: boolean) {
  const { manifest } = build
  const runnerArgs = [
    "run",
    "notion-as-code",
    "--",
    `--spaceId=${manifest.spaceId}`,
    `--scriptFilePath=${build.scriptPath}`,
    `--sessionStateFilePath=${build.sessionPath}`,
  ]

  if (dryRun) {
    console.log(`\n--dry: not running. The command would be:\n`)
    console.log(`  cd ${SDK_DIR} && npm ${runnerArgs.join(" ")}\n`)
    console.log(`Compile the script without calling Notion with:  npm run check -- ${manifest.name}`)
    return
  }

  const token = readToken(manifest.tokenRef, manifest.opAccount)
  console.log(`\nrunning…\n`)

  const result = spawnSync("npm", runnerArgs, {
    cwd: SDK_DIR,
    stdio: "inherit",
    env: { ...process.env, NOTION_TOKEN: token },
  })

  if (result.status !== 0) {
    console.error(`\nRun failed (exit ${result.status}).`)
    process.exit(result.status ?? 1)
  }
}

/**
 * Deploys through `ntn notion-as-code apply`: compiles the script with the
 * vendored template runtime, then applies the intents file with the build's
 * session.json as the explicit state file (never ntn's named state store).
 */
function deployWithNtn(build: Build, dryRun: boolean) {
  const { manifest } = build
  const intents = compileWithNtnRuntime(build.scriptPath)
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nac-apply-"))
  const intentsPath = path.join(tempDir, "intents.json")
  fs.writeFileSync(intentsPath, JSON.stringify(intents, null, 2))
  const applyArgs = [
    "notion-as-code",
    "apply",
    intentsPath,
    `--state=${build.sessionPath}`,
  ]
  const shownArgs = ["notion-as-code", "apply", "<compiled intents.json>", applyArgs[3]]

  try {
    console.log(`engine:    ntn (${intents.length} intents)`)
    if (dryRun) {
      console.log(`\n--dry: not running. The command would be:\n`)
      console.log(
        `  NOTION_WORKSPACE_ID=${manifest.spaceId} NOTION_API_TOKEN=<from ${manifest.tokenRef ?? "$NOTION_TOKEN"}> ntn ${shownArgs.join(" ")}\n`
      )
      console.log(`Intents by type: ${JSON.stringify(countByType(intents))}`)
      return
    }

    const token = readToken(manifest.tokenRef, manifest.opAccount)
    console.log(`\nrunning…\n`)
    const result = spawnSync("ntn", applyArgs, {
      stdio: "inherit",
      env: {
        ...process.env,
        NOTION_API_TOKEN: token,
        NOTION_WORKSPACE_ID: manifest.spaceId,
      },
    })
    if (result.status !== 0) {
      console.error(`\nRun failed (exit ${result.status}).`)
      process.exit(result.status ?? 1)
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

function countByType(intents: Array<{ type: string }>): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const intent of intents) counts[intent.type] = (counts[intent.type] ?? 0) + 1
  return counts
}

try {
  main()
} catch (error: any) {
  console.error(`\n✗ ${error.message ?? error}`)
  console.error(`\nAvailable builds: ${listBuildNames().join(", ")}`)
  process.exit(1)
}
