import { AzureDevOpsClient } from './azure-client.js';
import { WorkItem } from './types.js';

export interface ReleaseNotesOptions {
  version?: string;
  iterationPath?: string;
  wiql?: string;
  workItemIds?: number[];
  project?: string;
  includeDescription?: boolean;
}

interface GroupedItems {
  epics: WorkItem[];
  features: WorkItem[];
  userStories: WorkItem[];
  bugs: WorkItem[];
  tasks: WorkItem[];
  other: WorkItem[];
}

function getField(item: WorkItem, field: string): any {
  return item.fields?.[field];
}

function groupByType(items: WorkItem[]): GroupedItems {
  const groups: GroupedItems = {
    epics: [],
    features: [],
    userStories: [],
    bugs: [],
    tasks: [],
    other: [],
  };

  for (const item of items) {
    const type = (getField(item, 'System.WorkItemType') || '').toLowerCase();
    if (type === 'epic') groups.epics.push(item);
    else if (type === 'feature') groups.features.push(item);
    else if (type === 'user story' || type === 'product backlog item') groups.userStories.push(item);
    else if (type === 'bug') groups.bugs.push(item);
    else if (type === 'task') groups.tasks.push(item);
    else groups.other.push(item);
  }

  return groups;
}

function formatWorkItem(item: WorkItem, includeDescription: boolean): string {
  const id = item.id;
  const title = getField(item, 'System.Title') || 'Untitled';
  const state = getField(item, 'System.State') || 'Unknown';
  const assignedTo = getField(item, 'System.AssignedTo')?.displayName || 'Unassigned';
  const priority = getField(item, 'Microsoft.VSTS.Common.Priority');

  let line = `- **#${id}** ${title} — _${state}_ (Assigned: ${assignedTo})`;
  if (priority) line += ` [P${priority}]`;

  if (includeDescription) {
    const desc = getField(item, 'System.Description');
    if (desc) {
      // Strip HTML tags for clean markdown
      const cleanDesc = desc.replace(/<[^>]*>/g, '').trim();
      if (cleanDesc) {
        line += `\n  > ${cleanDesc.substring(0, 200)}${cleanDesc.length > 200 ? '...' : ''}`;
      }
    }
  }

  return line;
}

function formatSection(title: string, items: WorkItem[], includeDescription: boolean): string {
  if (items.length === 0) return '';

  const lines = [
    `### ${title} (${items.length})`,
    '',
    ...items.map((item) => formatWorkItem(item, includeDescription)),
    '',
  ];

  return lines.join('\n');
}

export async function generateReleaseNotes(
  client: AzureDevOpsClient,
  options: ReleaseNotesOptions
): Promise<string> {
  let items: WorkItem[] = [];

  if (options.workItemIds && options.workItemIds.length > 0) {
    // Fetch by explicit IDs
    items = await client.getWorkItems(options.workItemIds, 'All');
  } else if (options.wiql) {
    // Fetch by custom WIQL query
    items = await client.queryWorkItems(options.wiql, options.project);
  } else if (options.iterationPath) {
    // Fetch all resolved/closed items in an iteration
    const wiql = `SELECT [System.Id] FROM workitems WHERE [System.IterationPath] UNDER '${options.iterationPath}' AND [System.State] IN ('Resolved', 'Closed', 'Done', 'Completed') ORDER BY [System.WorkItemType], [Microsoft.VSTS.Common.Priority]`;
    items = await client.queryWorkItems(wiql, options.project);
  } else {
    throw new Error('Provide iterationPath, wiql, or workItemIds to generate release notes');
  }

  if (items.length === 0) {
    return '# Release Notes\n\nNo work items found matching the specified criteria.';
  }

  const groups = groupByType(items);
  const includeDesc = options.includeDescription ?? false;
  const now = new Date().toISOString().split('T')[0];
  const versionStr = options.version ? ` v${options.version}` : '';

  // Summary stats
  const stateMap: Record<string, number> = {};
  for (const item of items) {
    const state = getField(item, 'System.State') || 'Unknown';
    stateMap[state] = (stateMap[state] || 0) + 1;
  }
  const stateStats = Object.entries(stateMap)
    .map(([state, count]) => `${state}: ${count}`)
    .join(' | ');

  const sections: string[] = [
    `# Release Notes${versionStr}`,
    '',
    `**Date:** ${now}`,
    `**Total Items:** ${items.length}`,
    `**By Status:** ${stateStats}`,
    '',
    '---',
    '',
  ];

  // Add each type section
  sections.push(formatSection('🚀 Epics', groups.epics, includeDesc));
  sections.push(formatSection('✨ Features', groups.features, includeDesc));
  sections.push(formatSection('📖 User Stories', groups.userStories, includeDesc));
  sections.push(formatSection('🐛 Bug Fixes', groups.bugs, includeDesc));
  sections.push(formatSection('✅ Tasks', groups.tasks, includeDesc));
  sections.push(formatSection('📋 Other Items', groups.other, includeDesc));

  return sections.filter(Boolean).join('\n');
}
