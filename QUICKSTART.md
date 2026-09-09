# Quick Start — Azure DevOps MCP Server

Get up and running in 5 minutes.

## 1. Prerequisites

- **Node.js** 18+ installed
- **Azure DevOps** account with a **Personal Access Token** (PAT)

## 2. Add to VS Code

Create `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "azure-devops": {
      "command": "npx",
      "args": ["-y", "mcp-azure-selfhosted"],
      "env": {
        "AZURE_DEVOPS_ORG_URL": "https://dev.azure.com/your-org",
        "AZURE_DEVOPS_PAT": "your-pat-here",
        "AZURE_DEVOPS_PROJECT": "MyProject"
      }
    }
  }
}
```

## 3. Use It

Open GitHub Copilot Chat and try:

- *"List all projects in my Azure DevOps org"* → calls `azure_list_projects`
- *"Create a bug titled 'Login broken on mobile' with priority 1"* → calls `azure_create_work_item`
- *"Show me all active bugs assigned to me"* → calls `azure_query_work_items`
- *"Generate release notes for Sprint 23"* → calls `azure_generate_release_notes`

## 4. Optional: Local Development

```bash
git clone https://github.com/edrich13/mcp-azure-selfhosted.git
cd mcp-azure-selfhosted
npm install
npm run build
node build/index.js
```

## PAT Scopes Needed

When creating your Personal Access Token, enable:

- **Work Items** → Read & Write
- **Project and Team** → Read

That's it! See [README.md](README.md) for the full 25-tool reference.
