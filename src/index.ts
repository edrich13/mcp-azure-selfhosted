#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { AzureDevOpsClient } from './azure-client.js';
import { WorkItemCreateInput, WorkItemUpdateInput, PrdDecompositionInput, TestStep } from './types.js';
import { generateReleaseNotes, ReleaseNotesOptions } from './release-notes.js';
import * as fs from 'fs';
import * as path from 'path';

// ─── Environment Configuration ─────────────────────────────────────────────

function checkEnvironmentConfig(): { isConfigured: boolean; error?: string } {
  const orgUrl = process.env.AZURE_DEVOPS_ORG_URL;
  const pat = process.env.AZURE_DEVOPS_PAT;

  if (!orgUrl || !pat) {
    return {
      isConfigured: false,
      error:
        'AZURE_DEVOPS_ORG_URL and AZURE_DEVOPS_PAT environment variables are required. Please configure them before using Azure DevOps functionality.',
    };
  }
  return { isConfigured: true };
}

// ─── Lazy Client Initialization ─────────────────────────────────────────────

let azureClient: AzureDevOpsClient | null = null;

function getClient(): AzureDevOpsClient {
  const config = checkEnvironmentConfig();
  if (!config.isConfigured) {
    throw new Error(config.error);
  }

  if (!azureClient) {
    azureClient = new AzureDevOpsClient({
      orgUrl: process.env.AZURE_DEVOPS_ORG_URL!,
      personalAccessToken: process.env.AZURE_DEVOPS_PAT!,
      defaultProject: process.env.AZURE_DEVOPS_PROJECT,
      apiVersion: process.env.AZURE_DEVOPS_API_VERSION,
    });
  }

  return azureClient;
}

// ─── Tool Definitions ─────────────────────────────────────────────────────

const tools: Tool[] = [
  // ── Work Item CRUD ──────────────────────────────────────────────────────
  {
    name: 'azure_create_work_item',
    description:
      'Create a new work item in Azure DevOps. Supports Bug, User Story, Task, Feature, Epic, and any custom type. Provide fields like title, description, assigned to, priority, area path, iteration path, tags, story points, severity, repro steps, acceptance criteria, and custom fields.',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Project name (uses default if not provided)',
        },
        type: {
          type: 'string',
          description: 'Work item type: Bug, User Story, Task, Feature, Epic, etc.',
        },
        title: {
          type: 'string',
          description: 'Title of the work item',
        },
        description: {
          type: 'string',
          description: 'Detailed description (HTML supported)',
        },
        assignedTo: {
          type: 'string',
          description: 'Display name or email of the person to assign to',
        },
        areaPath: {
          type: 'string',
          description: 'Area path (e.g., "MyProject\\Team A")',
        },
        iterationPath: {
          type: 'string',
          description: 'Iteration/sprint path (e.g., "MyProject\\Sprint 1")',
        },
        priority: {
          type: 'number',
          description: 'Priority: 1 (Critical), 2 (High), 3 (Medium), 4 (Low)',
        },
        severity: {
          type: 'string',
          description: 'Severity for bugs: "1 - Critical", "2 - High", "3 - Medium", "4 - Low"',
        },
        tags: {
          type: 'string',
          description: 'Semicolon-separated tags (e.g., "frontend; urgent; v2.0")',
        },
        storyPoints: {
          type: 'number',
          description: 'Story points estimate',
        },
        effort: {
          type: 'number',
          description: 'Effort estimate',
        },
        acceptanceCriteria: {
          type: 'string',
          description: 'Acceptance criteria (HTML supported)',
        },
        reproSteps: {
          type: 'string',
          description: 'Repro steps for bugs (HTML supported)',
        },
        customFields: {
          type: 'object',
          description:
            'Map of custom field reference names to values (e.g., {"Custom.MyField": "value"})',
          additionalProperties: true,
        },
      },
      required: ['type', 'title'],
    },
  },
  {
    name: 'azure_get_work_item',
    description:
      'Get details of a specific work item by its ID. Returns all fields including title, state, assigned to, description, priority, tags, and more.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Work item ID',
        },
        expand: {
          type: 'string',
          description: 'Expand options: None, Relations, Fields, Links, All (default: All)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'azure_get_work_items',
    description:
      'Get multiple work items by their IDs in a single batch request (up to 200 at once).',
    inputSchema: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of work item IDs (max 200)',
        },
        expand: {
          type: 'string',
          description: 'Expand options: None, Relations, Fields, Links, All',
        },
      },
      required: ['ids'],
    },
  },
  {
    name: 'azure_update_work_item',
    description:
      'Update an existing work item. Can update any combination of fields: title, description, state, assigned to, priority, severity, area path, iteration path, tags, story points, effort, acceptance criteria, repro steps, and custom fields.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Work item ID to update',
        },
        title: { type: 'string', description: 'New title' },
        state: {
          type: 'string',
          description: 'New state (e.g., "New", "Active", "Resolved", "Closed")',
        },
        reason: { type: 'string', description: 'State change reason' },
        description: { type: 'string', description: 'New description (HTML supported)' },
        assignedTo: {
          type: 'string',
          description: 'Display name or email to assign to',
        },
        areaPath: { type: 'string', description: 'New area path' },
        iterationPath: { type: 'string', description: 'New iteration/sprint path' },
        priority: { type: 'number', description: 'Priority: 1-4' },
        severity: { type: 'string', description: 'Severity for bugs' },
        tags: { type: 'string', description: 'Semicolon-separated tags' },
        storyPoints: { type: 'number', description: 'Story points' },
        effort: { type: 'number', description: 'Effort estimate' },
        acceptanceCriteria: { type: 'string', description: 'Acceptance criteria' },
        reproSteps: { type: 'string', description: 'Repro steps for bugs' },
        customFields: {
          type: 'object',
          description: 'Map of custom field reference names to values',
          additionalProperties: true,
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'azure_delete_work_item',
    description:
      'Delete a work item by ID. By default moves to recycle bin; set destroy=true to permanently delete.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Work item ID to delete',
        },
        destroy: {
          type: 'boolean',
          description: 'If true, permanently destroys the work item (default: false)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'azure_query_work_items',
    description:
      'Execute a WIQL (Work Item Query Language) query to search and filter work items. Examples: "SELECT [System.Id], [System.Title] FROM workitems WHERE [System.State] = \'Active\' AND [System.WorkItemType] = \'Bug\'", "SELECT [System.Id] FROM workitems WHERE [System.AssignedTo] = @Me AND [System.State] <> \'Closed\'"',
    inputSchema: {
      type: 'object',
      properties: {
        wiql: {
          type: 'string',
          description: 'WIQL query string',
        },
        project: {
          type: 'string',
          description: 'Project scope for the query (uses default if not provided)',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results (default: 200)',
        },
      },
      required: ['wiql'],
    },
  },

  // ── State & Assignment ─────────────────────────────────────────────────
  {
    name: 'azure_change_state',
    description:
      'Change the state of a work item. Common states: New, Active, Resolved, Closed, Removed. States vary by work item type and process template.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Work item ID' },
        state: {
          type: 'string',
          description: 'Target state (e.g., "Active", "Resolved", "Closed", "Done")',
        },
        reason: {
          type: 'string',
          description: 'Optional reason for the state change',
        },
      },
      required: ['id', 'state'],
    },
  },
  {
    name: 'azure_assign_work_item',
    description: 'Assign or reassign a work item to a specific user.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Work item ID' },
        assignedTo: {
          type: 'string',
          description: 'Display name or email of the user to assign to',
        },
      },
      required: ['id', 'assignedTo'],
    },
  },
  {
    name: 'azure_update_fields',
    description:
      'Bulk update multiple fields on a work item in a single operation. Useful for changing priority, severity, area, iteration, tags, and custom fields simultaneously.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Work item ID' },
        fields: {
          type: 'object',
          description:
            'Map of field reference names to values. Example: {"System.Title": "New Title", "Microsoft.VSTS.Common.Priority": 1, "System.Tags": "urgent; frontend"}',
          additionalProperties: true,
        },
      },
      required: ['id', 'fields'],
    },
  },

  // ── Comments ───────────────────────────────────────────────────────────
  {
    name: 'azure_add_comment',
    description: 'Add a comment to a work item.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Work item ID' },
        text: { type: 'string', description: 'Comment text (HTML supported)' },
        project: {
          type: 'string',
          description: 'Project name (uses default if not provided)',
        },
      },
      required: ['id', 'text'],
    },
  },
  {
    name: 'azure_get_comments',
    description: 'Get all comments on a work item.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Work item ID' },
        project: {
          type: 'string',
          description: 'Project name (uses default if not provided)',
        },
      },
      required: ['id'],
    },
  },

  // ── Relationships / Links ──────────────────────────────────────────────
  {
    name: 'azure_link_work_items',
    description:
      'Create a link between two work items. Common link types: System.LinkTypes.Hierarchy-Forward (parent→child), System.LinkTypes.Hierarchy-Reverse (child→parent), System.LinkTypes.Related, System.LinkTypes.Duplicate-Forward, Microsoft.VSTS.Common.Affects-Forward.',
    inputSchema: {
      type: 'object',
      properties: {
        sourceId: { type: 'number', description: 'Source work item ID' },
        targetId: { type: 'number', description: 'Target work item ID' },
        linkType: {
          type: 'string',
          description:
            'Relation type reference name (e.g., "System.LinkTypes.Hierarchy-Forward" for parent-child)',
        },
        comment: {
          type: 'string',
          description: 'Optional comment for the link',
        },
      },
      required: ['sourceId', 'targetId', 'linkType'],
    },
  },
  {
    name: 'azure_get_relation_types',
    description:
      'List all available work item relation/link types (parent-child, related, duplicate, etc.).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // ── Projects ───────────────────────────────────────────────────────────
  {
    name: 'azure_list_projects',
    description: 'List all projects in the Azure DevOps organization.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'azure_get_project',
    description: 'Get details of a specific project.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Project name or ID' },
      },
      required: ['name'],
    },
  },

  // ── Teams ──────────────────────────────────────────────────────────────
  {
    name: 'azure_list_teams',
    description: 'List all teams in a project.',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Project name (uses default if not provided)',
        },
      },
    },
  },
  {
    name: 'azure_get_team_members',
    description: 'Get members of a specific team.',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Project name (uses default if not provided)',
        },
        team: { type: 'string', description: 'Team name' },
      },
      required: ['team'],
    },
  },

  // ── Metadata ───────────────────────────────────────────────────────────
  {
    name: 'azure_get_work_item_types',
    description:
      'List available work item types for a project (Bug, User Story, Task, Feature, Epic, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Project name (uses default if not provided)',
        },
      },
    },
  },
  {
    name: 'azure_get_fields',
    description:
      'List available work item fields. Useful for discovering field reference names for queries and updates.',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Optional project name to scope fields',
        },
      },
    },
  },
  {
    name: 'azure_get_areas',
    description: 'Get the area path hierarchy for a project.',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Project name (uses default if not provided)',
        },
        depth: {
          type: 'number',
          description: 'Depth of child nodes to retrieve (default: 5)',
        },
      },
    },
  },
  {
    name: 'azure_get_iterations',
    description: 'Get the iteration/sprint hierarchy for a project.',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Project name (uses default if not provided)',
        },
        depth: {
          type: 'number',
          description: 'Depth of child nodes to retrieve (default: 5)',
        },
      },
    },
  },

  // ── History ────────────────────────────────────────────────────────────
  {
    name: 'azure_get_work_item_history',
    description:
      'Get the update history of a work item — shows all field changes, state transitions, and link modifications over time.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Work item ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'azure_get_work_item_revisions',
    description: 'Get all revisions (snapshots) of a work item at each point in time.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Work item ID' },
      },
      required: ['id'],
    },
  },

  // ── Release Notes ──────────────────────────────────────────────────────
  {
    name: 'azure_get_sprint_work_items',
    description:
      'Get all work items in a specific sprint/iteration. Returns stories, bugs, tasks, features, and epics within the iteration path.',
    inputSchema: {
      type: 'object',
      properties: {
        iterationPath: {
          type: 'string',
          description: 'Iteration path (e.g., "MyProject\\Sprint 1")',
        },
        project: {
          type: 'string',
          description: 'Project name (uses default if not provided)',
        },
        types: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Filter by work item types (e.g., ["Bug", "User Story"]). If empty, returns all types.',
        },
        states: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Filter by states (e.g., ["Active", "Resolved", "Closed"]). If empty, returns all states.',
        },
      },
      required: ['iterationPath'],
    },
  },
  {
    name: 'azure_generate_release_notes',
    description:
      'Generate formatted release notes from work items. Can generate from an iteration/sprint, a WIQL query, or explicit work item IDs. Groups items by type (Epics, Features, User Stories, Bug Fixes, Tasks) with summary statistics.',
    inputSchema: {
      type: 'object',
      properties: {
        version: {
          type: 'string',
          description: 'Version string for the release notes header (e.g., "2.1.0")',
        },
        iterationPath: {
          type: 'string',
          description: 'Generate from an iteration/sprint path',
        },
        wiql: {
          type: 'string',
          description: 'Generate from a custom WIQL query',
        },
        workItemIds: {
          type: 'array',
          items: { type: 'number' },
          description: 'Generate from specific work item IDs',
        },
        project: {
          type: 'string',
          description: 'Project name (uses default if not provided)',
        },
        includeDescription: {
          type: 'boolean',
          description: 'Include work item descriptions in output (default: false)',
        },
      },
    },
  },

  // ── Git & Repos ────────────────────────────────────────────────────────
  {
    name: 'azure_get_file_content',
    description:
      'Get the raw content of a file from a Git repository in Azure DevOps. Provide the repository name/ID and the file path. Optionally specify a branch (defaults to the repo default branch).',
    inputSchema: {
      type: 'object',
      properties: {
        repository: {
          type: 'string',
          description: 'Repository name or ID',
        },
        path: {
          type: 'string',
          description: 'File path within the repo (e.g., "/src/index.ts" or "src/index.ts")',
        },
        project: {
          type: 'string',
          description: 'Project name (uses default if not provided)',
        },
        branch: {
          type: 'string',
          description: 'Branch name (e.g., "main"). Defaults to the repository default branch.',
        },
      },
      required: ['repository', 'path'],
    },
  },
  {
    name: 'azure_search_code',
    description:
      'Search code across repositories in a project using Azure DevOps Code Search. Requires the Code Search extension to be installed on the organization/collection. Returns matching files with paths and repositories.',
    inputSchema: {
      type: 'object',
      properties: {
        searchText: {
          type: 'string',
          description: 'Text or code to search for (supports code search filters like func:, class:)',
        },
        project: {
          type: 'string',
          description: 'Project name to scope the search (uses default if not provided)',
        },
        top: {
          type: 'number',
          description: 'Maximum number of results (default: 25)',
        },
        repository: {
          type: 'string',
          description: 'Optional repository name to restrict the search',
        },
      },
      required: ['searchText'],
    },
  },

  // ── Cross-cutting Dev Insight ──────────────────────────────────────────
  {
    name: 'azure_get_my_work_items',
    description:
      "Get work items currently assigned to the authenticated user (the PAT owner). Excludes Closed/Removed/Done by default. Answers \"what's assigned to me right now\".",
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Project name to scope (uses default if not provided)',
        },
        types: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional filter by work item types (e.g., ["Bug", "Task"])',
        },
        includeClosed: {
          type: 'boolean',
          description: 'Include Closed/Removed/Done items (default: false)',
        },
      },
    },
  },

  // ── Product / Program Management ───────────────────────────────────────
  {
    name: 'azure_bulk_create_work_items',
    description:
      'Create multiple work items in one call (e.g., importing a batch from a PRD or backlog list). Each item is created independently; partial failures are reported without aborting the rest.',
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'Array of work items to create',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', description: 'Work item type (Bug, User Story, Task, Feature, Epic, ...)' },
              title: { type: 'string', description: 'Title' },
              description: { type: 'string', description: 'Description (HTML supported)' },
              assignedTo: { type: 'string', description: 'Display name or email' },
              areaPath: { type: 'string', description: 'Area path' },
              iterationPath: { type: 'string', description: 'Iteration/sprint path' },
              priority: { type: 'number', description: 'Priority 1-4' },
              severity: { type: 'string', description: 'Severity for bugs' },
              tags: { type: 'string', description: 'Semicolon-separated tags' },
              storyPoints: { type: 'number', description: 'Story points' },
              effort: { type: 'number', description: 'Effort estimate' },
              acceptanceCriteria: { type: 'string', description: 'Acceptance criteria' },
              reproSteps: { type: 'string', description: 'Repro steps for bugs' },
              customFields: { type: 'object', additionalProperties: true, description: 'Custom fields map' },
            },
            required: ['type', 'title'],
          },
        },
        project: {
          type: 'string',
          description: 'Default project for items that do not specify their own (uses env default if not provided)',
        },
      },
      required: ['items'],
    },
  },
  {
    name: 'azure_get_delivery_plan',
    description:
      'Get cross-team delivery plans (roadmap/timeline). Without a planId, lists all delivery plans in the project. With a planId, returns that plan\'s delivery timeline.',
    inputSchema: {
      type: 'object',
      properties: {
        planId: {
          type: 'string',
          description: 'Optional delivery plan ID. If omitted, lists all plans.',
        },
        project: {
          type: 'string',
          description: 'Project name (uses default if not provided)',
        },
      },
    },
  },
  {
    name: 'azure_generate_prd_to_stories',
    description:
      'Decompose a feature/PRD into a work item hierarchy and create it: a parent Feature, its child User Stories, and each story\'s child Tasks — all linked with parent-child relationships. Provide the structured breakdown (the agent produces this from a PRD). Returns the created hierarchy with IDs.',
    inputSchema: {
      type: 'object',
      properties: {
        featureTitle: { type: 'string', description: 'Title of the parent feature' },
        featureDescription: { type: 'string', description: 'Feature description (HTML supported)' },
        featureType: { type: 'string', description: 'Parent work item type (default: "Feature")' },
        storyType: { type: 'string', description: 'Story work item type (default: "User Story")' },
        taskType: { type: 'string', description: 'Task work item type (default: "Task")' },
        areaPath: { type: 'string', description: 'Area path applied to all created items' },
        iterationPath: { type: 'string', description: 'Iteration path applied to all created items' },
        project: { type: 'string', description: 'Project name (uses default if not provided)' },
        stories: {
          type: 'array',
          description: 'Child user stories, each optionally containing tasks',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Story title' },
              description: { type: 'string', description: 'Story description' },
              acceptanceCriteria: { type: 'string', description: 'Acceptance criteria' },
              storyPoints: { type: 'number', description: 'Story points' },
              assignedTo: { type: 'string', description: 'Assignee' },
              tags: { type: 'string', description: 'Semicolon-separated tags' },
              tasks: {
                type: 'array',
                description: 'Child tasks for this story',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string', description: 'Task title' },
                    description: { type: 'string', description: 'Task description' },
                    assignedTo: { type: 'string', description: 'Assignee' },
                    effort: { type: 'number', description: 'Effort estimate' },
                  },
                  required: ['title'],
                },
              },
            },
            required: ['title'],
          },
        },
      },
      required: ['featureTitle', 'stories'],
    },
  },

  // ── Design / Attachments ───────────────────────────────────────────────
  {
    name: 'azure_add_attachment',
    description:
      'Attach a file (mockup, screenshot, document) to a work item. Provide either a local filePath to read from disk, or inline content (optionally base64-encoded for binary files).',
    inputSchema: {
      type: 'object',
      properties: {
        workItemId: { type: 'number', description: 'Work item ID to attach to' },
        fileName: { type: 'string', description: 'File name to store (e.g., "mockup.png")' },
        filePath: {
          type: 'string',
          description: 'Absolute local path to a file to upload (preferred for images/binaries)',
        },
        content: {
          type: 'string',
          description: 'Inline file content (used if filePath is not provided)',
        },
        contentBase64: {
          type: 'boolean',
          description: 'Set true if "content" is base64-encoded binary data',
        },
        comment: { type: 'string', description: 'Optional comment for the attachment link' },
        project: { type: 'string', description: 'Project name (uses default if not provided)' },
      },
      required: ['workItemId', 'fileName'],
    },
  },
  {
    name: 'azure_get_attachments',
    description:
      'List the attachments (design assets, screenshots, docs) referenced on a work item. Returns names and download URLs. Optionally downloads them to a local directory.',
    inputSchema: {
      type: 'object',
      properties: {
        workItemId: { type: 'number', description: 'Work item ID' },
        downloadDir: {
          type: 'string',
          description: 'Optional absolute directory path to download the attachments into',
        },
      },
      required: ['workItemId'],
    },
  },

  // ── QA / Test ──────────────────────────────────────────────────────────
  {
    name: 'azure_list_test_plans',
    description: 'List all test plans in a project.',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project name (uses default if not provided)' },
      },
    },
  },
  {
    name: 'azure_get_test_plan',
    description: 'Get details of a specific test plan by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        planId: { type: 'number', description: 'Test plan ID' },
        project: { type: 'string', description: 'Project name (uses default if not provided)' },
      },
      required: ['planId'],
    },
  },
  {
    name: 'azure_list_test_suites',
    description: 'List all test suites within a test plan.',
    inputSchema: {
      type: 'object',
      properties: {
        planId: { type: 'number', description: 'Test plan ID' },
        project: { type: 'string', description: 'Project name (uses default if not provided)' },
      },
      required: ['planId'],
    },
  },
  {
    name: 'azure_create_test_case',
    description:
      'Create a Test Case work item with ordered test steps (action + expected result). Optionally add it to a test plan suite.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Test case title' },
        steps: {
          type: 'array',
          description: 'Ordered test steps',
          items: {
            type: 'object',
            properties: {
              action: { type: 'string', description: 'Action to perform' },
              expected: { type: 'string', description: 'Expected result (makes it a validation step)' },
            },
            required: ['action'],
          },
        },
        priority: { type: 'number', description: 'Priority 1-4' },
        areaPath: { type: 'string', description: 'Area path' },
        iterationPath: { type: 'string', description: 'Iteration path' },
        planId: { type: 'number', description: 'Optional test plan ID to add the case to (requires suiteId)' },
        suiteId: { type: 'number', description: 'Optional suite ID to add the case to (requires planId)' },
        project: { type: 'string', description: 'Project name (uses default if not provided)' },
      },
      required: ['title', 'steps'],
    },
  },
  {
    name: 'azure_add_test_result',
    description:
      'Record a pass/fail result for a test case. Creates an ad-hoc test run, adds the outcome, and completes the run. Outcome must be one of: Passed, Failed, Blocked, NotApplicable, NotExecuted.',
    inputSchema: {
      type: 'object',
      properties: {
        testCaseId: { type: 'number', description: 'Test case work item ID' },
        outcome: {
          type: 'string',
          description: 'Result outcome: Passed, Failed, Blocked, NotApplicable, NotExecuted',
        },
        planId: { type: 'number', description: 'Optional test plan ID to associate the run with' },
        comment: { type: 'string', description: 'Optional comment / failure notes' },
        runName: { type: 'string', description: 'Optional name for the test run' },
        testCaseTitle: { type: 'string', description: 'Optional test case title for the result' },
        project: { type: 'string', description: 'Project name (uses default if not provided)' },
      },
      required: ['testCaseId', 'outcome'],
    },
  },
  {
    name: 'azure_create_bug_from_test_failure',
    description:
      'Auto-file a Bug from a failed test, building repro steps from the error message, stack trace, and steps. Optionally links the bug to the failing test case.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Bug title' },
        testCaseId: { type: 'number', description: 'Optional failing test case ID to link' },
        errorMessage: { type: 'string', description: 'Error/assertion message' },
        stackTrace: { type: 'string', description: 'Stack trace' },
        steps: { type: 'string', description: 'Steps that led to the failure (HTML supported)' },
        assignedTo: { type: 'string', description: 'Assignee' },
        priority: { type: 'number', description: 'Priority 1-4' },
        severity: { type: 'string', description: 'Severity (e.g., "2 - High")' },
        areaPath: { type: 'string', description: 'Area path' },
        iterationPath: { type: 'string', description: 'Iteration path' },
        tags: { type: 'string', description: 'Semicolon-separated tags' },
        project: { type: 'string', description: 'Project name (uses default if not provided)' },
      },
      required: ['title'],
    },
  },
  {
    name: 'azure_duplicate_detection',
    description:
      'Find likely-duplicate work items (bugs by default) before creating a new one. Matches on title keywords and ranks candidates by similarity score (0-1). Excludes closed items by default.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title/summary of the new item to check for duplicates' },
        types: {
          type: 'array',
          items: { type: 'string' },
          description: 'Work item types to search (default: ["Bug"])',
        },
        top: { type: 'number', description: 'Max candidates to return (default: 5)' },
        includeClosed: { type: 'boolean', description: 'Include closed/resolved items (default: false)' },
        project: { type: 'string', description: 'Project name (uses default if not provided)' },
      },
      required: ['title'],
    },
  },
];

// ─── Server Instance ─────────────────────────────────────────────────────────

const server = new Server(
  {
    name: 'mcp-azure-selfhosted',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ─── List Tools Handler ──────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// ─── Call Tool Handler ───────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args = {} } = request.params;

    switch (name) {
      // ── Work Item CRUD ────────────────────────────────────────────────

      case 'azure_create_work_item': {
        const input: WorkItemCreateInput = {
          project: args.project as string,
          type: args.type as string,
          title: args.title as string,
          description: args.description as string | undefined,
          assignedTo: args.assignedTo as string | undefined,
          areaPath: args.areaPath as string | undefined,
          iterationPath: args.iterationPath as string | undefined,
          priority: args.priority as number | undefined,
          severity: args.severity as string | undefined,
          tags: args.tags as string | undefined,
          storyPoints: args.storyPoints as number | undefined,
          effort: args.effort as number | undefined,
          acceptanceCriteria: args.acceptanceCriteria as string | undefined,
          reproSteps: args.reproSteps as string | undefined,
          customFields: args.customFields as Record<string, any> | undefined,
        };
        const item = await getClient().createWorkItem(input);
        return {
          content: [
            {
              type: 'text',
              text: `Successfully created ${args.type} #${item.id}\n\n${JSON.stringify(item, null, 2)}`,
            },
          ],
        };
      }

      case 'azure_get_work_item': {
        const item = await getClient().getWorkItem(
          args.id as number,
          (args.expand as string) || 'All'
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(item, null, 2) }],
        };
      }

      case 'azure_get_work_items': {
        const items = await getClient().getWorkItems(
          args.ids as number[],
          args.expand as string
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(items, null, 2) }],
        };
      }

      case 'azure_update_work_item': {
        const input: WorkItemUpdateInput = {
          title: args.title as string | undefined,
          state: args.state as string | undefined,
          reason: args.reason as string | undefined,
          description: args.description as string | undefined,
          assignedTo: args.assignedTo as string | undefined,
          areaPath: args.areaPath as string | undefined,
          iterationPath: args.iterationPath as string | undefined,
          priority: args.priority as number | undefined,
          severity: args.severity as string | undefined,
          tags: args.tags as string | undefined,
          storyPoints: args.storyPoints as number | undefined,
          effort: args.effort as number | undefined,
          acceptanceCriteria: args.acceptanceCriteria as string | undefined,
          reproSteps: args.reproSteps as string | undefined,
          customFields: args.customFields as Record<string, any> | undefined,
        };
        const item = await getClient().updateWorkItem(args.id as number, input);
        return {
          content: [
            {
              type: 'text',
              text: `Successfully updated work item #${item.id}\n\n${JSON.stringify(item, null, 2)}`,
            },
          ],
        };
      }

      case 'azure_delete_work_item': {
        await getClient().deleteWorkItem(args.id as number, args.destroy as boolean);
        return {
          content: [
            {
              type: 'text',
              text: `Successfully ${args.destroy ? 'destroyed' : 'deleted'} work item #${args.id}`,
            },
          ],
        };
      }

      case 'azure_query_work_items': {
        const items = await getClient().queryWorkItems(
          args.wiql as string,
          args.project as string | undefined,
          args.maxResults as number | undefined
        );
        return {
          content: [
            {
              type: 'text',
              text: `Found ${items.length} work items\n\n${JSON.stringify(items, null, 2)}`,
            },
          ],
        };
      }

      // ── State & Assignment ────────────────────────────────────────────

      case 'azure_change_state': {
        const item = await getClient().changeState(
          args.id as number,
          args.state as string,
          args.reason as string | undefined
        );
        return {
          content: [
            {
              type: 'text',
              text: `Successfully changed state of #${item.id} to "${args.state}"\n\n${JSON.stringify(item, null, 2)}`,
            },
          ],
        };
      }

      case 'azure_assign_work_item': {
        const item = await getClient().assignWorkItem(
          args.id as number,
          args.assignedTo as string
        );
        return {
          content: [
            {
              type: 'text',
              text: `Successfully assigned #${item.id} to "${args.assignedTo}"\n\n${JSON.stringify(item, null, 2)}`,
            },
          ],
        };
      }

      case 'azure_update_fields': {
        const fields = args.fields as Record<string, any>;
        const input: WorkItemUpdateInput = { customFields: fields };
        const item = await getClient().updateWorkItem(args.id as number, input);
        return {
          content: [
            {
              type: 'text',
              text: `Successfully updated fields on #${item.id}\n\n${JSON.stringify(item, null, 2)}`,
            },
          ],
        };
      }

      // ── Comments ──────────────────────────────────────────────────────

      case 'azure_add_comment': {
        const comment = await getClient().addComment(
          args.project as string,
          args.id as number,
          args.text as string
        );
        return {
          content: [
            {
              type: 'text',
              text: `Successfully added comment to #${args.id}\n\n${JSON.stringify(comment, null, 2)}`,
            },
          ],
        };
      }

      case 'azure_get_comments': {
        const comments = await getClient().getComments(
          args.project as string,
          args.id as number
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(comments, null, 2) }],
        };
      }

      // ── Links / Relations ─────────────────────────────────────────────

      case 'azure_link_work_items': {
        const item = await getClient().linkWorkItems(
          args.sourceId as number,
          args.targetId as number,
          args.linkType as string,
          args.comment as string | undefined
        );
        return {
          content: [
            {
              type: 'text',
              text: `Successfully linked #${args.sourceId} → #${args.targetId} (${args.linkType})\n\n${JSON.stringify(item, null, 2)}`,
            },
          ],
        };
      }

      case 'azure_get_relation_types': {
        const types = await getClient().getRelationTypes();
        return {
          content: [{ type: 'text', text: JSON.stringify(types, null, 2) }],
        };
      }

      // ── Projects ──────────────────────────────────────────────────────

      case 'azure_list_projects': {
        const projects = await getClient().getProjects();
        return {
          content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }],
        };
      }

      case 'azure_get_project': {
        const project = await getClient().getProject(args.name as string);
        return {
          content: [{ type: 'text', text: JSON.stringify(project, null, 2) }],
        };
      }

      // ── Teams ─────────────────────────────────────────────────────────

      case 'azure_list_teams': {
        const teams = await getClient().getTeams(args.project as string);
        return {
          content: [{ type: 'text', text: JSON.stringify(teams, null, 2) }],
        };
      }

      case 'azure_get_team_members': {
        const members = await getClient().getTeamMembers(
          args.project as string,
          args.team as string
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(members, null, 2) }],
        };
      }

      // ── Metadata ──────────────────────────────────────────────────────

      case 'azure_get_work_item_types': {
        const types = await getClient().getWorkItemTypes(args.project as string);
        return {
          content: [{ type: 'text', text: JSON.stringify(types, null, 2) }],
        };
      }

      case 'azure_get_fields': {
        const fields = await getClient().getFields(args.project as string | undefined);
        return {
          content: [{ type: 'text', text: JSON.stringify(fields, null, 2) }],
        };
      }

      case 'azure_get_areas': {
        const areas = await getClient().getAreas(
          args.project as string,
          args.depth as number | undefined
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(areas, null, 2) }],
        };
      }

      case 'azure_get_iterations': {
        const iterations = await getClient().getIterations(
          args.project as string,
          args.depth as number | undefined
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(iterations, null, 2) }],
        };
      }

      // ── History ───────────────────────────────────────────────────────

      case 'azure_get_work_item_history': {
        const updates = await getClient().getWorkItemUpdates(args.id as number);
        return {
          content: [{ type: 'text', text: JSON.stringify(updates, null, 2) }],
        };
      }

      case 'azure_get_work_item_revisions': {
        const revisions = await getClient().getWorkItemRevisions(args.id as number);
        return {
          content: [{ type: 'text', text: JSON.stringify(revisions, null, 2) }],
        };
      }

      // ── Release Notes ─────────────────────────────────────────────────

      case 'azure_get_sprint_work_items': {
        const iterationPath = args.iterationPath as string;
        const types = args.types as string[] | undefined;
        const states = args.states as string[] | undefined;

        let wiql = `SELECT [System.Id] FROM workitems WHERE [System.IterationPath] UNDER '${iterationPath}'`;
        if (types && types.length > 0) {
          const typeFilter = types.map((t) => `'${t}'`).join(', ');
          wiql += ` AND [System.WorkItemType] IN (${typeFilter})`;
        }
        if (states && states.length > 0) {
          const stateFilter = states.map((s) => `'${s}'`).join(', ');
          wiql += ` AND [System.State] IN (${stateFilter})`;
        }
        wiql += ' ORDER BY [System.WorkItemType], [Microsoft.VSTS.Common.Priority]';

        const items = await getClient().queryWorkItems(wiql, args.project as string | undefined);
        return {
          content: [
            {
              type: 'text',
              text: `Found ${items.length} work items in "${iterationPath}"\n\n${JSON.stringify(items, null, 2)}`,
            },
          ],
        };
      }

      case 'azure_generate_release_notes': {
        const options: ReleaseNotesOptions = {
          version: args.version as string | undefined,
          iterationPath: args.iterationPath as string | undefined,
          wiql: args.wiql as string | undefined,
          workItemIds: args.workItemIds as number[] | undefined,
          project: args.project as string | undefined,
          includeDescription: args.includeDescription as boolean | undefined,
        };
        const notes = await generateReleaseNotes(getClient(), options);
        return {
          content: [{ type: 'text', text: notes }],
        };
      }

      // ── Git & Repos ───────────────────────────────────────────────────

      case 'azure_get_file_content': {
        const content = await getClient().getFileContent(
          args.repository as string,
          args.path as string,
          args.project as string | undefined,
          args.branch as string | undefined
        );
        return {
          content: [{ type: 'text', text: content }],
        };
      }

      case 'azure_search_code': {
        const results = await getClient().searchCode(
          args.searchText as string,
          args.project as string | undefined,
          args.top as number | undefined,
          args.repository as string | undefined
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
        };
      }

      // ── Cross-cutting Dev Insight ─────────────────────────────────────

      case 'azure_get_my_work_items': {
        const items = await getClient().getMyWorkItems(
          args.project as string | undefined,
          args.types as string[] | undefined,
          args.includeClosed as boolean | undefined
        );
        return {
          content: [
            {
              type: 'text',
              text: `Found ${items.length} work items assigned to you\n\n${JSON.stringify(items, null, 2)}`,
            },
          ],
        };
      }

      // ── Product / Program Management ──────────────────────────────────

      case 'azure_bulk_create_work_items': {
        const rawItems = (args.items as any[]) || [];
        const defaultProject = args.project as string | undefined;
        const items: WorkItemCreateInput[] = rawItems.map((it) => ({
          project: (it.project as string) || (defaultProject as string),
          type: it.type as string,
          title: it.title as string,
          description: it.description,
          assignedTo: it.assignedTo,
          areaPath: it.areaPath,
          iterationPath: it.iterationPath,
          priority: it.priority,
          severity: it.severity,
          tags: it.tags,
          storyPoints: it.storyPoints,
          effort: it.effort,
          acceptanceCriteria: it.acceptanceCriteria,
          reproSteps: it.reproSteps,
          customFields: it.customFields,
        }));
        const result = await getClient().bulkCreateWorkItems(items);
        return {
          content: [
            {
              type: 'text',
              text: `Created ${result.created.length} work item(s); ${result.errors.length} failed.\n\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      }

      case 'azure_get_delivery_plan': {
        const planId = args.planId as string | undefined;
        const project = args.project as string | undefined;
        if (planId) {
          const timeline = await getClient().getDeliveryPlanTimeline(planId, project);
          return {
            content: [{ type: 'text', text: JSON.stringify(timeline, null, 2) }],
          };
        }
        const plans = await getClient().getDeliveryPlans(project);
        return {
          content: [
            {
              type: 'text',
              text: `Found ${plans.length} delivery plan(s)\n\n${JSON.stringify(plans, null, 2)}`,
            },
          ],
        };
      }

      case 'azure_generate_prd_to_stories': {
        const input: PrdDecompositionInput = {
          project: args.project as string | undefined,
          featureTitle: args.featureTitle as string,
          featureDescription: args.featureDescription as string | undefined,
          featureType: args.featureType as string | undefined,
          storyType: args.storyType as string | undefined,
          taskType: args.taskType as string | undefined,
          areaPath: args.areaPath as string | undefined,
          iterationPath: args.iterationPath as string | undefined,
          stories: (args.stories as any[]) || [],
        };
        const hierarchy = await getClient().createHierarchyFromPrd(input);
        return {
          content: [
            {
              type: 'text',
              text: `Created feature #${hierarchy.feature.id} with ${hierarchy.stories.length} stor(ies).\n\n${JSON.stringify(hierarchy, null, 2)}`,
            },
          ],
        };
      }

      // ── Design / Attachments ──────────────────────────────────────────

      case 'azure_add_attachment': {
        const fileName = args.fileName as string;
        const filePath = args.filePath as string | undefined;
        let buffer: Buffer;
        if (filePath) {
          buffer = fs.readFileSync(filePath);
        } else if (args.content !== undefined) {
          buffer = args.contentBase64
            ? Buffer.from(args.content as string, 'base64')
            : Buffer.from(args.content as string, 'utf8');
        } else {
          throw new Error('Provide either "filePath" or "content" to attach.');
        }
        const item = await getClient().addAttachment(
          args.workItemId as number,
          fileName,
          buffer,
          args.project as string | undefined,
          args.comment as string | undefined
        );
        return {
          content: [
            {
              type: 'text',
              text: `Attached "${fileName}" to work item #${item.id}.`,
            },
          ],
        };
      }

      case 'azure_get_attachments': {
        const attachments = await getClient().getAttachments(args.workItemId as number);
        const downloadDir = args.downloadDir as string | undefined;
        const downloaded: string[] = [];
        if (downloadDir && attachments.length > 0) {
          fs.mkdirSync(downloadDir, { recursive: true });
          for (const att of attachments) {
            const data = await getClient().downloadAttachment(att.url);
            const target = path.join(downloadDir, att.name || att.resourceId || 'attachment');
            fs.writeFileSync(target, data);
            downloaded.push(target);
          }
        }
        return {
          content: [
            {
              type: 'text',
              text:
                `Found ${attachments.length} attachment(s)` +
                (downloaded.length ? `; downloaded ${downloaded.length} to ${downloadDir}` : '') +
                `\n\n${JSON.stringify({ attachments, downloaded }, null, 2)}`,
            },
          ],
        };
      }

      // ── QA / Test ─────────────────────────────────────────────────────

      case 'azure_list_test_plans': {
        const plans = await getClient().getTestPlans(args.project as string | undefined);
        return {
          content: [
            {
              type: 'text',
              text: `Found ${plans.length} test plan(s)\n\n${JSON.stringify(plans, null, 2)}`,
            },
          ],
        };
      }

      case 'azure_get_test_plan': {
        const plan = await getClient().getTestPlan(
          args.planId as number,
          args.project as string | undefined
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(plan, null, 2) }],
        };
      }

      case 'azure_list_test_suites': {
        const suites = await getClient().getTestSuites(
          args.planId as number,
          args.project as string | undefined
        );
        return {
          content: [
            {
              type: 'text',
              text: `Found ${suites.length} test suite(s)\n\n${JSON.stringify(suites, null, 2)}`,
            },
          ],
        };
      }

      case 'azure_create_test_case': {
        const testCase = await getClient().createTestCase(
          args.title as string,
          (args.steps as TestStep[]) || [],
          args.project as string | undefined,
          {
            areaPath: args.areaPath as string | undefined,
            iterationPath: args.iterationPath as string | undefined,
            priority: args.priority as number | undefined,
            planId: args.planId as number | undefined,
            suiteId: args.suiteId as number | undefined,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: `Created Test Case #${testCase.id}\n\n${JSON.stringify(testCase, null, 2)}`,
            },
          ],
        };
      }

      case 'azure_add_test_result': {
        const result = await getClient().addTestResult(
          args.testCaseId as number,
          args.outcome as string,
          args.project as string | undefined,
          {
            planId: args.planId as number | undefined,
            comment: args.comment as string | undefined,
            runName: args.runName as string | undefined,
            testCaseTitle: args.testCaseTitle as string | undefined,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: `Recorded "${args.outcome}" for test case #${args.testCaseId}\n\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      }

      case 'azure_create_bug_from_test_failure': {
        const bug = await getClient().createBugFromTestFailure({
          title: args.title as string,
          project: args.project as string | undefined,
          testCaseId: args.testCaseId as number | undefined,
          errorMessage: args.errorMessage as string | undefined,
          stackTrace: args.stackTrace as string | undefined,
          steps: args.steps as string | undefined,
          assignedTo: args.assignedTo as string | undefined,
          priority: args.priority as number | undefined,
          severity: args.severity as string | undefined,
          areaPath: args.areaPath as string | undefined,
          iterationPath: args.iterationPath as string | undefined,
          tags: args.tags as string | undefined,
        });
        return {
          content: [
            {
              type: 'text',
              text: `Filed Bug #${bug.id} from test failure\n\n${JSON.stringify(bug, null, 2)}`,
            },
          ],
        };
      }

      case 'azure_duplicate_detection': {
        const candidates = await getClient().findDuplicates(
          args.title as string,
          args.project as string | undefined,
          args.types as string[] | undefined,
          args.top as number | undefined,
          args.includeClosed as boolean | undefined
        );
        return {
          content: [
            {
              type: 'text',
              text:
                candidates.length === 0
                  ? 'No likely duplicates found.'
                  : `Found ${candidates.length} possible duplicate(s)\n\n${JSON.stringify(candidates, null, 2)}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    const details = error.response?.data
      ? JSON.stringify(error.response.data, null, 2)
      : '';
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}${details ? `\n\n${details}` : ''}`,
        },
      ],
      isError: true,
    };
  }
});

// ─── Start Server ────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  const config = checkEnvironmentConfig();
  if (config.isConfigured) {
    console.error('Azure DevOps MCP Server running on stdio (configured)');
  } else {
    console.error(
      'Azure DevOps MCP Server running on stdio (not configured - AZURE_DEVOPS_ORG_URL and AZURE_DEVOPS_PAT required)'
    );
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
