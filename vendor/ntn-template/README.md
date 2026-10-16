# Vendored Notion as Code runtime (ntn engine)

`types.d.ts`, `notion.ts` and `LICENSE.md` are copied unchanged from
[makenotion/notion-as-code-template](https://github.com/makenotion/notion-as-code-template)
at `80be619` (2026-10-06), the template that `ntn notion-as-code new` downloads
with `ntn` 0.23.20. Don't edit them; re-copy them from a newer template commit
and update this line.

`globals.d.ts` is ours. It declares the `notion` global so build scripts keep
the repo's no-import convention.

Builds with `"engine": "ntn"` in `build.json` compile against this runtime and
deploy through `ntn notion-as-code apply`. Every other build still uses the
`notion-sdk-js` checkout (`EXPERIMENTAL__notion-as-code` @ `3d33935`). See
docs/FINDINGS.md finding 25.
