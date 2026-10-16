/**
 * template-demo: the example spec (templates/workspace-setup/example.spec.ts)
 * with names changed so it can't be confused with setup-core in the demo workspace.
 */
import { defineSpec } from "../../templates/workspace-setup/spec"

export default defineSpec({
  engagement: {
    client: "Template Demo",
    workspaceId: "a426b878-1c06-81cd-8ffa-0003fa91e0c8",
    specDocUrl: "https://app.notion.com/p/3fb91b0711ac81cb83b8e90aed121577",
    signedOffOn: "2026-10-16",
  },
  companyTeamspace: {
    name: "Template Demo Company",
    icon: { type: "notion_icon", description: "building", color: "gray" },
    description: "Company-wide home and the core databases every team works from.",
  },
  teams: [
    { key: "ops", name: "TD Operations", access: "closed", color: "blue", icon: { type: "notion_icon", description: "gear", color: "blue" } },
    { key: "mkt", name: "TD Marketing", access: "closed", color: "pink", icon: { type: "notion_icon", description: "megaphone", color: "pink" } },
  ],
  coreDatabases: {
    projects: {
      addProperties: [
        { key: "budget", name: "Budget", type: "number" },
        { key: "client-facing", name: "Client-facing", type: "checkbox" },
      ],
    },
  },
  teamDatabases: [
    {
      key: "vendors",
      team: "ops",
      name: "Vendors",
      icon: { type: "notion_icon", description: "storefront", color: "blue" },
      purpose: "Suppliers the Operations team manages.",
      properties: [
        { key: "category", name: "Category", type: "select", options: ["Software", "Facilities", "Services"] },
        { key: "contract-end", name: "Contract end", type: "date" },
        { key: "projects", name: "Projects", type: "relation", relationTo: "projects" },
      ],
    },
  ],
  homePages: {
    company: "Start here. The four core databases are below; each team works from filtered views of them in its own teamspace.",
    teams: { mkt: "Marketing's home. Campaigns live in Projects; tag anything cross-team with both teams." },
  },
  addOns: { crm: false },
})
