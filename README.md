# MCP Azure DevOps Self-Hosted Server

MCP server for self-hosted (and cloud) Azure DevOps instances with Personal Access Token authentication. Provides **25 tools** covering all Azure DevOps Work Item Tracking operations.

## Features

- **Work Item CRUD** — Create, read, update, delete bugs, user stories, tasks, features, epics, and any custom types
- **State Management** — Change work item states (New → Active → Resolved → Closed)
- **Assignment** — Assign/reassign work items to team members
- **WIQL Queries** — Execute Work Item Query Language queries for advanced search/filtering
- **Comments** — Add and retrieve comments on work items
- **Relationships** — Link work items (parent-child, related, duplicate, etc.)
- **Project & Team Info** — List projects, teams, team members
- **Metadata Discovery** — Work item types, fields, area paths, iteration/sprint paths
- **History & Audit** — Full change history and revision snapshots
- **Release Notes** — Auto-generate formatted release notes from sprints/iterations

## Quick Start

```bash
# 1. Install dependencies
cd mcp-azure-selfhosted
npm install

# 2. Build
npm run build

# 3. Configure environment
cp .env.example .env
# Edit .env with your Azure DevOps URL and PAT

# 4. Run
node build/index.js
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AZURE_DEVOPS_ORG_URL` | Yes | Your Azure DevOps organization URL |
| `AZURE_DEVOPS_PAT` | Yes | Personal Access Token |
| `AZURE_DEVOPS_PROJECT` | No | Default project name (can be overridden per tool call) |
| `AZURE_DEVOPS_API_VERSION` | No | API version (default: `7.1`) |
| `NODE_TLS_REJECT_UNAUTHORIZED` | No | Set to `0` for self-hosted instances with self-signed or expired SSL certificates |

### URL Formats

**Cloud (Azure DevOps Services):**
```
https://dev.azure.com/{organization}
```

**Self-Hosted (Azure DevOps Server / TFS):**
```
https://{server}:{port}/tfs/{collection}
```

### Creating a PAT

1. Go to your Azure DevOps → User Settings → Personal Access Tokens
2. Click **New Token**
3. Set the following scopes:
   - **Work Items**: Read & Write
   - **Project and Team**: Read
4. Copy the token and set it as `AZURE_DEVOPS_PAT`

## MCP Integration

### VS Code (Copilot / Cline)

Add to your `.vscode/mcp.json` or VS Code settings:

```json
{
  "servers": {
    "azure-devops": {
      "command": "node",
      "args": ["/path/to/mcp-azure-selfhosted/build/index.js"],
      "env": {
        "AZURE_DEVOPS_ORG_URL": "https://dev.azure.com/your-org",
        "AZURE_DEVOPS_PAT": "your-pat-here",
        "AZURE_DEVOPS_PROJECT": "MyProject",
        "NODE_TLS_REJECT_UNAUTHORIZED": "0"
      }
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "azure-devops": {
      "command": "node",
      "args": ["/path/to/mcp-azure-selfhosted/build/index.js"],
      "env": {
        "AZURE_DEVOPS_ORG_URL": "https://dev.azure.com/your-org",
        "AZURE_DEVOPS_PAT": "your-pat-here",
        "AZURE_DEVOPS_PROJECT": "MyProject",
        "NODE_TLS_REJECT_UNAUTHORIZED": "0"
      }
    }
  }
}
```

> **Note:** Set `NODE_TLS_REJECT_UNAUTHORIZED` to `"0"` only for self-hosted instances with self-signed or expired SSL certificates. Remove it when connecting to Azure DevOps Services (cloud).

## Tools Reference

### Work Item CRUD (6 tools)

| Tool | Description |
|------|-------------|
| `azure_create_work_item` | Create a new Bug, User Story, Task, Feature, Epic, or custom type |
| `azure_get_work_item` | Get a work item by ID with all fields |
| `azure_get_work_items` | Batch get up to 200 work items by IDs |
| `azure_update_work_item` | Update any fields on a work item |
| `azure_delete_work_item` | Delete (or permanently destroy) a work item |
| `azure_query_work_items` | Execute WIQL queries to search/filter work items |

### State & Assignment (3 tools)

| Tool | Description |
|------|-------------|
| `azure_change_state` | Change work item state (New, Active, Resolved, Closed, etc.) |
| `azure_assign_work_item` | Assign/reassign a work item to a user |
| `azure_update_fields` | Bulk update multiple fields in one operation |

### Comments (2 tools)

| Tool | Description |
|------|-------------|
| `azure_add_comment` | Add a comment to a work item |
| `azure_get_comments` | Get all comments on a work item |

### Relationships (2 tools)

| Tool | Description |
|------|-------------|
| `azure_link_work_items` | Link two work items (parent-child, related, duplicate, etc.) |
| `azure_get_relation_types` | List all available relation/link types |

### Projects & Teams (4 tools)

| Tool | Description |
|------|-------------|
| `azure_list_projects` | List all projects in the organization |
| `azure_get_project` | Get details of a specific project |
| `azure_list_teams` | List all teams in a project |
| `azure_get_team_members` | Get members of a specific team |

### Metadata (4 tools)

| Tool | Description |
|------|-------------|
| `azure_get_work_item_types` | List available work item types (Bug, Story, Task, etc.) |
| `azure_get_fields` | List available work item fields and their reference names |
| `azure_get_areas` | Get area path hierarchy |
| `azure_get_iterations` | Get iteration/sprint hierarchy |

### History (2 tools)

| Tool | Description |
|------|-------------|
| `azure_get_work_item_history` | Get field change history (who changed what, when) |
| `azure_get_work_item_revisions` | Get full snapshots at each revision |

### Release Notes (2 tools)

| Tool | Description |
|------|-------------|
| `azure_get_sprint_work_items` | Get all work items in a sprint/iteration |
| `azure_generate_release_notes` | Generate formatted markdown release notes |

## Examples

### Create a Bug

```
Tool: azure_create_work_item
Arguments:
  type: "Bug"
  title: "Login page crashes on mobile"
  description: "The login page throws a JS error on iOS Safari"
  priority: 1
  severity: "2 - High"
  assignedTo: "John Doe"
  tags: "frontend; mobile; urgent"
  reproSteps: "<ol><li>Open app on iOS Safari</li><li>Navigate to login</li><li>Page crashes</li></ol>"
```

### Query Active Bugs

```
Tool: azure_query_work_items
Arguments:
  wiql: "SELECT [System.Id], [System.Title], [System.State] FROM workitems WHERE [System.WorkItemType] = 'Bug' AND [System.State] = 'Active' ORDER BY [Microsoft.VSTS.Common.Priority]"
```

### Generate Release Notes

```
Tool: azure_generate_release_notes
Arguments:
  version: "2.1.0"
  iterationPath: "MyProject\\Sprint 23"
  includeDescription: true
```

### Link Parent-Child

```
Tool: azure_link_work_items
Arguments:
  sourceId: 100
  targetId: 101
  linkType: "System.LinkTypes.Hierarchy-Forward"
  comment: "Feature contains this story"
```

## Development

```bash
# Watch mode (auto-rebuild on changes)
npm run watch

# Dev mode (tsx, direct TS execution)
npm run dev
```

## License

MIT
