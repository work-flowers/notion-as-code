// Declares the `notion` global that builds/*/build.ts scripts use, so builds
// with `"engine": "ntn"` type-check against the vendored template types. The
// SDK branch's types.ts declared its DSL types globally; the two the core
// template names (templates/workspace-setup/template.ts) are re-declared here.
import type {
  notion as notionApi,
  PropertySchemaDefinition as PropertySchemaDefinitionType,
  ViewSchema as ViewSchemaType,
} from "./types"

declare global {
  const notion: typeof notionApi
  type PropertySchemaDefinition = PropertySchemaDefinitionType
  type ViewSchema = ViewSchemaType
}

export {}
