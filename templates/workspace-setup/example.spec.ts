/**
 * Example spec matching the setup-core demo build (demo workspace). Copy to
 * builds/<client>/spec.ts and replace from the client's signed-off doc.
 */
import { defineSpec } from "./spec"

export default defineSpec({
  engagement: {
    client: "workFlowers Demo",
    workspaceId: "a426b878-1c06-81cd-8ffa-0003fa91e0c8",
    specDocUrl: "https://app.notion.com/p/<spec-doc>",
    signedOffOn: "2026-10-16",
  },
  companyTeamspace: {
    name: "Company",
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
  },
  addOns: { crm: false },
})
