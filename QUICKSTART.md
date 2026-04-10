# Quick Start — Azure DevOps MCP Server

Get up and running in 5 minutes.

## 1. Prerequisites

- **Node.js** 18+ installed
- **Azure DevOps** account with a **Personal Access Token** (PAT)

## 2. Install & Build

```bash
cd mcp-azure-selfhosted
npm install
npm run build
```

## 3. Configure

```bash
cp .env.example .env
```

Edit `.env`:
```
AZURE_DEVOPS_ORG_URL=https://dev.azure.com/your-org
AZURE_DEVOPS_PAT=your-token-here
AZURE_DEVOPS_PROJECT=MyProject
```

## 4. Add to VS Code

Create `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "azure-devops": {
      "command": "node",
      "args": ["/full/path/to/mcp-azure-selfhosted/build/index.js"],
      "env": {
        "AZURE_DEVOPS_ORG_URL": "https://dev.azure.com/your-org",
        "AZURE_DEVOPS_PAT": "your-pat-here",
        "AZURE_DEVOPS_PROJECT": "MyProject"
      }
    }
  }
}
```

## 5. Use It

Open GitHub Copilot Chat and try:

- *"List all projects in my Azure DevOps org"* → calls `azure_list_projects`
- *"Create a bug titled 'Login broken on mobile' with priority 1"* → calls `azure_create_work_item`
- *"Show me all active bugs assigned to me"* → calls `azure_query_work_items`
- *"Generate release notes for Sprint 23"* → calls `azure_generate_release_notes`

## PAT Scopes Needed

When creating your Personal Access Token, enable:
- **Work Items** → Read & Write
- **Project and Team** → Read

That's it! See [README.md](README.md) for the full 25-tool reference.
