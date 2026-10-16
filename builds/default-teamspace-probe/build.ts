/**
 * default-teamspace-probe — can a script make a teamspace a workspace default?
 *
 * Demo workspace only (non-private teamspaces allowed there; see
 * docs/GUARDRAILS.md). Kept apart from setup-core so its re-deploys can't
 * clear setup-core's relation values (finding 18).
 *
 * Two probes:
 *   - "Default Probe A" is created with accessLevel "default" on run 1.
 *   - "Default Probe B" is created "open" on run 1, then flipped to "default"
 *     on run 2, to test whether a re-deploy changes an existing teamspace's
 *     access level.
 *
 * Neither can touch the workspace's existing default teamspace: scripts can
 * only reference resources they create.
 */

const spaceParent = {
  type: "resourceId",
  resourceId: "dtp-demo-space",
} as const

const probeA = notion.teamspace({
  resourceId: "dtp-teamspace-a",
  parent: spaceParent,
  name: "Default Probe A",
  accessLevel: "default",
  icon: { type: "notion_icon", description: "flask", color: "green" },
  description: "Notion as Code probe: created with accessLevel default.",
})

probeA.addPage({
  resourceId: "dtp-page-a",
  icon: { type: "notion_icon", description: "flask", color: "green" },
  properties: { title: notion.text("About this probe") },
  content: `Created by the **default-teamspace-probe** build with \`accessLevel: "default"\`. Safe to delete.
`,
})

const probeB = notion.teamspace({
  resourceId: "dtp-teamspace-b",
  parent: spaceParent,
  name: "Default Probe B",
  // Run 1 deployed this as "open"; run 2 flips it.
  accessLevel: "default",
  icon: { type: "notion_icon", description: "flask", color: "orange" },
  description: "Notion as Code probe: created open, then re-deployed as default.",
})

probeB.addPage({
  resourceId: "dtp-page-b",
  icon: { type: "notion_icon", description: "flask", color: "orange" },
  properties: { title: notion.text("About this probe") },
  content: `Created by the **default-teamspace-probe** build as \`open\`, then re-deployed as \`default\`. Safe to delete.
`,
})

export {}
