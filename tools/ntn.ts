/**
 * The "ntn" engine: compiles a build script against the vendored
 * notion-as-code-template runtime (vendor/ntn-template) instead of the
 * notion-sdk-js checkout, for builds whose build.json sets `"engine": "ntn"`.
 * Those builds deploy through `ntn notion-as-code apply`, which run.ts drives.
 */
import { execFileSync } from "child_process"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { pathToFileURL } from "url"
import { REPO_ROOT, SDK_DIR } from "./builds"

export const NTN_VENDOR_DIR = path.join(REPO_ROOT, "vendor/ntn-template")

/**
 * Runs the script with the vendored runtime's `notion` as a global and returns
 * the intents it records — the same JSON `ntn notion-as-code apply` submits.
 */
export function compileWithNtnRuntime(scriptPath: string): any[] {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nac-ntn-"))
  try {
    const outPath = path.join(tempDir, "intents.json")
    const entryPath = path.join(tempDir, "entry.mts")
    const runtimeUrl = pathToFileURL(path.join(NTN_VENDOR_DIR, "notion.ts")).href
    const scriptUrl = pathToFileURL(scriptPath).href
    fs.writeFileSync(
      entryPath,
      `import { writeFileSync } from "node:fs"
import { notion, getIntents } from ${JSON.stringify(runtimeUrl)}
;(globalThis as any).notion = notion
await import(${JSON.stringify(scriptUrl)})
writeFileSync(${JSON.stringify(outPath)}, JSON.stringify(getIntents(), null, 2))
`
    )
    execFileSync(path.join(SDK_DIR, "node_modules/.bin/tsx"), [entryPath], {
      cwd: path.dirname(scriptPath),
      stdio: ["ignore", "inherit", "inherit"],
    })
    return JSON.parse(fs.readFileSync(outPath, "utf8"))
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}
