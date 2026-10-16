/**
 * Type-checks build scripts against the Notion as Code DSL declarations.
 *
 * The compile check only proves a script runs and has unique resourceIds; this
 * proves its property types, view configs and filter shapes are legal before a
 * deploy burns a run.
 *
 * Usage (from the repo root):
 *   npm run typecheck            # every build
 *   npm run typecheck -- crm     # one build
 */
import { spawnSync } from "child_process"
import * as path from "path"
import { listBuildNames, loadBuild, SDK_DIR } from "./builds"
import { NTN_VENDOR_DIR } from "./ntn"

const DSL_TYPES = path.join(
  SDK_DIR,
  "src/EXPERIMENTAL__notion-as-code/utils/types.ts"
)

function main() {
  const requested = process.argv.slice(2).filter(arg => !arg.startsWith("-"))
  const names = requested.length > 0 ? requested : listBuildNames()
  let failed = false

  for (const name of names) {
    const build = loadBuild(name)
    const dslTypes =
      build.manifest.engine === "ntn"
        ? path.join(NTN_VENDOR_DIR, "globals.d.ts")
        : DSL_TYPES
    const result = spawnSync(
      path.join(SDK_DIR, "node_modules/.bin/tsc"),
      [
        "--noEmit",
        "--strict",
        "--skipLibCheck",
        "--target",
        "ES2022",
        "--module",
        "esnext",
        "--moduleResolution",
        "bundler",
        dslTypes,
        build.scriptPath,
      ],
      { stdio: "inherit" }
    )
    if (result.status === 0) {
      console.log(`✓ ${name}`)
    } else {
      console.error(`✗ ${name} — type errors above`)
      failed = true
    }
  }

  if (failed) process.exit(1)
  console.log(`\nOK: ${names.length} build(s) type-check clean.`)
}

main()
