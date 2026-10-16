// Declares the `notion` global that builds/*/build.ts scripts use, so builds
// with `"engine": "ntn"` type-check against the vendored template types.
import type { notion as notionApi } from "./types"

declare global {
  const notion: typeof notionApi
}

export {}
