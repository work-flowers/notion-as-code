/**
 * Shared build-manifest loading and safety checks.
 *
 * A "build" is a directory under builds/ containing build.json (the manifest),
 * the Notion as Code script, and its session-state file. Everything else in
 * this repo resolves paths through here rather than by hand — mistyping the
 * pairing of script ↔ session ↔ workspace is the one mistake that can damage a
 * deployed build.
 */
import * as fs from "fs"
import * as path from "path"

export const REPO_ROOT = path.resolve(__dirname, "..")
export const BUILDS_DIR = path.join(REPO_ROOT, "builds")
export const SDK_DIR = path.join(REPO_ROOT, "notion-sdk-js")

export type BuildManifest = {
  name: string
  title: string
  spaceId: string
  spaceAnchorResourceId: string
  script: string
  session: string
  /**
   * Which Notion as Code toolchain compiles and deploys this build. "sdk"
   * (default) is the notion-sdk-js checkout; "ntn" is the vendored template
   * runtime plus `ntn notion-as-code apply` (see tools/ntn.ts).
   */
  engine?: "sdk" | "ntn"
  tokenRef?: string
  opAccount?: string
  autoIncrementPrefixes?: string[]
  status: "deployed" | "not-deployed"
  deployedAt?: string | null
  teamspace?: string
  hubUrl?: string | null
  modelledFrom?: string
}

export type Build = {
  manifest: BuildManifest
  dir: string
  scriptPath: string
  sessionPath: string
}

export function listBuildNames(): string[] {
  return fs
    .readdirSync(BUILDS_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .filter(entry => fs.existsSync(path.join(BUILDS_DIR, entry.name, "build.json")))
    .map(entry => entry.name)
    .sort()
}

export function loadBuild(name: string): Build {
  const dir = path.join(BUILDS_DIR, name)
  const manifestPath = path.join(dir, "build.json")
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `No build named "${name}". Available builds: ${listBuildNames().join(", ")}`
    )
  }
  const manifest = JSON.parse(
    fs.readFileSync(manifestPath, "utf8")
  ) as BuildManifest

  const scriptPath = path.join(dir, manifest.script)
  const sessionPath = path.join(dir, manifest.session)
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Script not found: ${scriptPath}`)
  }
  if (manifest.name !== name) {
    throw new Error(
      `Manifest name "${manifest.name}" does not match its directory "${name}".`
    )
  }
  return { manifest, dir, scriptPath, sessionPath }
}

export function loadAllBuilds(): Build[] {
  return listBuildNames().map(loadBuild)
}

/**
 * Verifies the session-state file actually belongs to this build: it must
 * exist, map the build's own space-anchor resourceId, and point at the build's
 * workspace. Guards against running a script against another build's ledger,
 * which would either orphan mappings or duplicate resources.
 */
export function assertSessionMatchesManifest(build: Build): void {
  const { manifest, sessionPath } = build
  if (!fs.existsSync(sessionPath)) {
    throw new Error(
      `Session-state file missing: ${sessionPath}\n` +
        `Seed it before the first run (see docs/GUARDRAILS.md) — running without ` +
        `one silently cancels in non-TTY shells.`
    )
  }
  const session = JSON.parse(fs.readFileSync(sessionPath, "utf8"))
  const mappings = session.resourceIdToPointerMappings ?? {}
  const anchor = mappings[manifest.spaceAnchorResourceId]

  if (!anchor) {
    throw new Error(
      `Session-state file ${manifest.session} does not map this build's space ` +
        `anchor "${manifest.spaceAnchorResourceId}". Mapped resourceIds: ` +
        `${Object.keys(mappings).slice(0, 5).join(", ")}… — is this the right ` +
        `session file for ${manifest.name}?`
    )
  }
  if (anchor.spaceId !== manifest.spaceId || anchor.id !== manifest.spaceId) {
    throw new Error(
      `Session-state anchor points at workspace ${anchor.spaceId ?? anchor.id}, ` +
        `but build.json declares ${manifest.spaceId}. Refusing to run.`
    )
  }
}

/**
 * Auto-increment ID prefixes are workspace-global (see docs/FINDINGS.md #6),
 * so two builds deployed to the same workspace must not claim the same prefix.
 */
export function findPrefixCollisions(
  builds: Build[]
): Array<{ prefix: string; builds: string[] }> {
  const byPrefix = new Map<string, string[]>()
  for (const build of builds) {
    for (const prefix of build.manifest.autoIncrementPrefixes ?? []) {
      const key = `${build.manifest.spaceId}::${prefix}`
      byPrefix.set(key, [...(byPrefix.get(key) ?? []), build.manifest.name])
    }
  }
  return [...byPrefix.entries()]
    .filter(([, names]) => names.length > 1)
    .map(([key, names]) => ({ prefix: key.split("::")[1]!, builds: names }))
}
