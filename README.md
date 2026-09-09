# MCP Azure DevOps Self-Hosted Server

MCP server for self-hosted (and cloud) Azure DevOps instances with Personal Access Token authentication. Provides **39 tools** covering Azure DevOps Work Item Tracking, Git, Test Plans, delivery plans, attachments, and productivity workflows.

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
- **Git & Repos** — Read file contents and search code across repositories
- **Test Plans** — List plans/suites, create test cases, record results, and file bugs from failures
- **Delivery Plans** — Inspect cross-team roadmaps and timelines
- **Attachments** — Attach and retrieve mockups, screenshots, and documents
- **Productivity** — Bulk-create work items, decompose a PRD into a Feature→Stories→Tasks hierarchy, detect duplicate bugs, and list "my work"

## Quick Start

### End Users (npx, no clone required)

Use the published npm package directly in your MCP config:

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

You can pin a version for deterministic installs by changing args to:

```json
["-y", "mcp-azure-selfhosted@1.0.0"]
```

### Local Development (clone and build)

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
      "command": "npx",
      "args": ["-y", "mcp-azure-selfhosted"],
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
      "command": "npx",
      "args": ["-y", "mcp-azure-selfhosted"],
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

### Git & Repos (2 tools)

| Tool | Description |
|------|-------------|
| `azure_get_file_content` | Get the raw content of a file from a Git repository (optional branch) |
| `azure_search_code` | Search code across a project (requires the Code Search extension) |

### Developer Productivity (1 tool)

| Tool | Description |
|------|-------------|
| `azure_get_my_work_items` | Get work items currently assigned to you (excludes Closed/Done by default) |

### Product & Program Management (3 tools)

| Tool | Description |
|------|-------------|
| `azure_bulk_create_work_items` | Create multiple work items in one call (e.g., import a backlog/PRD) |
| `azure_get_delivery_plan` | List delivery plans, or get a plan's delivery timeline |
| `azure_generate_prd_to_stories` | Create a Feature → User Stories → Tasks hierarchy from a structured breakdown |

### Attachments (2 tools)

| Tool | Description |
|------|-------------|
| `azure_add_attachment` | Attach a file (mockup/screenshot/doc) to a work item from a local path or inline content |
| `azure_get_attachments` | List a work item's attachments and optionally download them |

### Test Plans / QA (6 tools)

| Tool | Description |
|------|-------------|
| `azure_list_test_plans` | List all test plans in a project |
| `azure_get_test_plan` | Get details of a specific test plan |
| `azure_list_test_suites` | List all test suites within a test plan |
| `azure_create_test_case` | Create a Test Case with ordered steps; optionally add to a suite |
| `azure_add_test_result` | Record a pass/fail result for a test case (creates & completes a run) |
| `azure_create_bug_from_test_failure` | Auto-file a Bug from a failed test with repro details, linked to the test case |

### Duplicate Detection (1 tool)

| Tool | Description |
|------|-------------|
| `azure_duplicate_detection` | Find likely-duplicate work items by title similarity before creating a new one |

> **Note:** `azure_search_code` requires the Code Search extension on the organization/collection, and the Test Plans tools require Test Plans licensing.

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

## Publishing to npm (Maintainers)

```bash
# 1. Ensure package version is updated in package.json
npm version patch

# 2. Push commit and tag
git push origin main --follow-tags
```

Publishing is automated via GitHub Actions on tags matching `v*`.

Required repository secret:

- `NPM_TOKEN` (npm automation token with publish access)

## License

MIT
