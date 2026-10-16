/**
 * democo-2: a fresh deploy of the core template (TKT-978), replacing democo
 * after its re-deploy test cleared the Meeting Notes relations (finding 33).
 * Same spec: DemoCo HQ, Operations and Marketing, with sample records.
 */
import { defineSpec } from "../../templates/workspace-setup/spec"

export default defineSpec({
  engagement: {
    client: "DemoCo",
    workspaceId: "a426b878-1c06-81cd-8ffa-0003fa91e0c8",
    specDocUrl: "https://app.notion.com/p/3fb91b0711ac81cb83b8e90aed121577",
    signedOffOn: "2026-10-16",
  },
  companyTeamspace: {
    name: "DemoCo HQ",
    icon: { type: "notion_icon", description: "building", color: "gray" },
    description: "Company-wide home and the core databases every team works from.",
  },
  teams: [
    { key: "ops", name: "Operations", access: "closed", color: "blue", icon: { type: "notion_icon", description: "gear", color: "blue" } },
    { key: "mkt", name: "Marketing", access: "closed", color: "pink", icon: { type: "notion_icon", description: "megaphone", color: "pink" } },
  ],
  coreDatabases: {
    projects: {
      addProperties: [
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
  sampleRecords: true,
})
