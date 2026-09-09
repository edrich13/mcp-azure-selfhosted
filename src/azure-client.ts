import axios, { AxiosInstance } from 'axios';
import {
  AzureDevOpsConfig,
  WorkItem,
  WorkItemCreateInput,
  WorkItemUpdateInput,
  JsonPatchOperation,
  WiqlResult,
  Project,
  Team,
  TeamMember,
  WorkItemType,
  WorkItemFieldDefinition,
  ClassificationNode,
  WorkItemComment,
  WorkItemCommentList,
  WorkItemUpdate,
  WorkItemRelationType,
  ListResponse,
  GitRepository,
  CodeSearchResult,
  DeliveryPlan,
  AttachmentReference,
  WorkItemAttachment,
  TestPlan,
  TestSuite,
  TestStep,
  TestRunResult,
  PrdDecompositionInput,
  DuplicateCandidate,
} from './types.js';

// ─── XML / text helpers ──────────────────────────────────────────────────────

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildStepsXml(steps: TestStep[]): string {
  const stepXml = steps
    .map((s, i) => {
      const id = i + 2;
      const type = s.expected ? 'ValidateStep' : 'ActionStep';
      const action = escapeXml(s.action ?? '');
      const expected = escapeXml(s.expected ?? '');
      return (
        `<step id="${id}" type="${type}">` +
        `<parameterizedString isformatted="true">${action}</parameterizedString>` +
        `<parameterizedString isformatted="true">${expected}</parameterizedString>` +
        `<description/></step>`
      );
    })
    .join('');
  return `<steps id="0" last="${steps.length + 1}">${stepXml}</steps>`;
}

const DUPLICATE_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'when', 'not', 'are',
  'was', 'has', 'have', 'but', 'you', 'can', 'will', 'does', 'did', 'its',
  'bug', 'error', 'issue', 'fix', 'fixed', 'crash', 'fail', 'fails', 'failed',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !DUPLICATE_STOP_WORDS.has(w));
}

function diceCoefficient(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  return (2 * intersection) / (a.size + b.size);
}

export class AzureDevOpsClient {
  private client: AxiosInstance;
  private orgUrl: string;
  private defaultProject?: string;
  private apiVersion: string;

  constructor(config: AzureDevOpsConfig) {
    this.orgUrl = config.orgUrl.replace(/\/+$/, '');
    this.defaultProject = config.defaultProject;
    this.apiVersion = config.apiVersion || '7.1';

    // Azure DevOps PAT auth: Basic base64(:{pat})
    const token = Buffer.from(`:${config.personalAccessToken}`).toString('base64');

    this.client = axios.create({
      baseURL: this.orgUrl,
      headers: {
        Authorization: `Basic ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  private resolveProject(project?: string): string {
    const resolved = project || this.defaultProject;
    if (!resolved) {
      throw new Error(
        'Project is required. Either provide it as a parameter or set AZURE_DEVOPS_PROJECT environment variable.'
      );
    }
    return resolved;
  }

  private apiParams(extra?: Record<string, string>): Record<string, string> {
    return { 'api-version': this.apiVersion, ...extra };
  }

  // ─── Work Items ──────────────────────────────────────────────────────────

  async getWorkItem(id: number, expand?: string): Promise<WorkItem> {
    const params: Record<string, string> = this.apiParams();
    if (expand) params['$expand'] = expand;
    const response = await this.client.get(`/_apis/wit/workitems/${id}`, { params });
    return response.data;
  }

  async getWorkItems(ids: number[], expand?: string): Promise<WorkItem[]> {
    const params: Record<string, string> = this.apiParams({
      ids: ids.join(','),
    });
    if (expand) params['$expand'] = expand;
    const response = await this.client.get('/_apis/wit/workitems', { params });
    return response.data.value;
  }

  async createWorkItem(input: WorkItemCreateInput): Promise<WorkItem> {
    const project = this.resolveProject(input.project);
    const patchOps: JsonPatchOperation[] = [];

    // Required field
    patchOps.push({ op: 'add', path: '/fields/System.Title', value: input.title });

    // Optional standard fields
    if (input.description !== undefined) {
      patchOps.push({ op: 'add', path: '/fields/System.Description', value: input.description });
    }
    if (input.assignedTo) {
      patchOps.push({ op: 'add', path: '/fields/System.AssignedTo', value: input.assignedTo });
    }
    if (input.areaPath) {
      patchOps.push({ op: 'add', path: '/fields/System.AreaPath', value: input.areaPath });
    }
    if (input.iterationPath) {
      patchOps.push({ op: 'add', path: '/fields/System.IterationPath', value: input.iterationPath });
    }
    if (input.priority !== undefined) {
      patchOps.push({ op: 'add', path: '/fields/Microsoft.VSTS.Common.Priority', value: input.priority });
    }
    if (input.severity) {
      patchOps.push({ op: 'add', path: '/fields/Microsoft.VSTS.Common.Severity', value: input.severity });
    }
    if (input.tags) {
      patchOps.push({ op: 'add', path: '/fields/System.Tags', value: input.tags });
    }
    if (input.storyPoints !== undefined) {
      patchOps.push({ op: 'add', path: '/fields/Microsoft.VSTS.Scheduling.StoryPoints', value: input.storyPoints });
    }
    if (input.effort !== undefined) {
      patchOps.push({ op: 'add', path: '/fields/Microsoft.VSTS.Scheduling.Effort', value: input.effort });
    }
    if (input.acceptanceCriteria) {
      patchOps.push({ op: 'add', path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria', value: input.acceptanceCriteria });
    }
    if (input.reproSteps) {
      patchOps.push({ op: 'add', path: '/fields/Microsoft.VSTS.TCM.ReproSteps', value: input.reproSteps });
    }

    // Custom fields pass-through
    if (input.customFields) {
      for (const [field, value] of Object.entries(input.customFields)) {
        const path = field.startsWith('/fields/') ? field : `/fields/${field}`;
        patchOps.push({ op: 'add', path, value });
      }
    }

    const response = await this.client.post(
      `/${encodeURIComponent(project)}/_apis/wit/workitems/$${encodeURIComponent(input.type)}`,
      patchOps,
      {
        params: this.apiParams(),
        headers: { 'Content-Type': 'application/json-patch+json' },
      }
    );
    return response.data;
  }

  async updateWorkItem(id: number, input: WorkItemUpdateInput): Promise<WorkItem> {
    const patchOps: JsonPatchOperation[] = [];

    if (input.title !== undefined) {
      patchOps.push({ op: 'replace', path: '/fields/System.Title', value: input.title });
    }
    if (input.state !== undefined) {
      patchOps.push({ op: 'replace', path: '/fields/System.State', value: input.state });
    }
    if (input.reason !== undefined) {
      patchOps.push({ op: 'replace', path: '/fields/System.Reason', value: input.reason });
    }
    if (input.description !== undefined) {
      patchOps.push({ op: 'replace', path: '/fields/System.Description', value: input.description });
    }
    if (input.assignedTo !== undefined) {
      patchOps.push({ op: 'replace', path: '/fields/System.AssignedTo', value: input.assignedTo });
    }
    if (input.areaPath !== undefined) {
      patchOps.push({ op: 'replace', path: '/fields/System.AreaPath', value: input.areaPath });
    }
    if (input.iterationPath !== undefined) {
      patchOps.push({ op: 'replace', path: '/fields/System.IterationPath', value: input.iterationPath });
    }
    if (input.priority !== undefined) {
      patchOps.push({ op: 'replace', path: '/fields/Microsoft.VSTS.Common.Priority', value: input.priority });
    }
    if (input.severity !== undefined) {
      patchOps.push({ op: 'replace', path: '/fields/Microsoft.VSTS.Common.Severity', value: input.severity });
    }
    if (input.tags !== undefined) {
      patchOps.push({ op: 'replace', path: '/fields/System.Tags', value: input.tags });
    }
    if (input.storyPoints !== undefined) {
      patchOps.push({ op: 'replace', path: '/fields/Microsoft.VSTS.Scheduling.StoryPoints', value: input.storyPoints });
    }
    if (input.effort !== undefined) {
      patchOps.push({ op: 'replace', path: '/fields/Microsoft.VSTS.Scheduling.Effort', value: input.effort });
    }
    if (input.acceptanceCriteria !== undefined) {
      patchOps.push({ op: 'replace', path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria', value: input.acceptanceCriteria });
    }
    if (input.reproSteps !== undefined) {
      patchOps.push({ op: 'replace', path: '/fields/Microsoft.VSTS.TCM.ReproSteps', value: input.reproSteps });
    }

    // Custom fields pass-through
    if (input.customFields) {
      for (const [field, value] of Object.entries(input.customFields)) {
        const path = field.startsWith('/fields/') ? field : `/fields/${field}`;
        patchOps.push({ op: 'replace', path, value });
      }
    }

    if (patchOps.length === 0) {
      throw new Error('No fields provided to update');
    }

    const response = await this.client.patch(
      `/_apis/wit/workitems/${id}`,
      patchOps,
      {
        params: this.apiParams(),
        headers: { 'Content-Type': 'application/json-patch+json' },
      }
    );
    return response.data;
  }

  async deleteWorkItem(id: number, destroy: boolean = false): Promise<void> {
    await this.client.delete(`/_apis/wit/workitems/${id}`, {
      params: this.apiParams({ destroy: String(destroy) }),
    });
  }

  // ─── Queries (WIQL) ─────────────────────────────────────────────────────

  async queryWorkItems(wiql: string, project?: string, maxResults: number = 200): Promise<WorkItem[]> {
    const proj = project || this.defaultProject;
    const basePath = proj ? `/${encodeURIComponent(proj)}/_apis/wit/wiql` : '/_apis/wit/wiql';

    const wiqlResponse = await this.client.post(
      basePath,
      { query: wiql },
      { params: this.apiParams({ '$top': String(maxResults) }) }
    );

    const result: WiqlResult = wiqlResponse.data;
    if (!result.workItems || result.workItems.length === 0) {
      return [];
    }

    // Fetch full work items in batches of 200
    const ids = result.workItems.map((wi) => wi.id);
    const allItems: WorkItem[] = [];

    for (let i = 0; i < ids.length; i += 200) {
      const batch = ids.slice(i, i + 200);
      const items = await this.getWorkItems(batch, 'All');
      allItems.push(...items);
    }

    return allItems;
  }

  // ─── State & Assignment ──────────────────────────────────────────────────

  async changeState(id: number, state: string, reason?: string): Promise<WorkItem> {
    const patchOps: JsonPatchOperation[] = [
      { op: 'replace', path: '/fields/System.State', value: state },
    ];
    if (reason) {
      patchOps.push({ op: 'replace', path: '/fields/System.Reason', value: reason });
    }

    const response = await this.client.patch(
      `/_apis/wit/workitems/${id}`,
      patchOps,
      {
        params: this.apiParams(),
        headers: { 'Content-Type': 'application/json-patch+json' },
      }
    );
    return response.data;
  }

  async assignWorkItem(id: number, assignedTo: string): Promise<WorkItem> {
    const patchOps: JsonPatchOperation[] = [
      { op: 'replace', path: '/fields/System.AssignedTo', value: assignedTo },
    ];

    const response = await this.client.patch(
      `/_apis/wit/workitems/${id}`,
      patchOps,
      {
        params: this.apiParams(),
        headers: { 'Content-Type': 'application/json-patch+json' },
      }
    );
    return response.data;
  }

  // ─── Comments ────────────────────────────────────────────────────────────

  async addComment(project: string, id: number, text: string): Promise<WorkItemComment> {
    const proj = this.resolveProject(project);
    const response = await this.client.post(
      `/${encodeURIComponent(proj)}/_apis/wit/workitems/${id}/comments`,
      { text },
      { params: this.apiParams() }
    );
    return response.data;
  }

  async getComments(project: string, id: number): Promise<WorkItemCommentList> {
    const proj = this.resolveProject(project);
    const response = await this.client.get(
      `/${encodeURIComponent(proj)}/_apis/wit/workitems/${id}/comments`,
      { params: this.apiParams() }
    );
    return response.data;
  }

  // ─── Links / Relations ──────────────────────────────────────────────────

  async linkWorkItems(
    sourceId: number,
    targetId: number,
    linkType: string,
    comment?: string
  ): Promise<WorkItem> {
    // Get the target work item URL
    const targetItem = await this.getWorkItem(targetId);
    const targetUrl = targetItem.url;

    const patchOps: JsonPatchOperation[] = [
      {
        op: 'add',
        path: '/relations/-',
        value: {
          rel: linkType,
          url: targetUrl,
          attributes: {
            comment: comment || '',
          },
        },
      },
    ];

    const response = await this.client.patch(
      `/_apis/wit/workitems/${sourceId}`,
      patchOps,
      {
        params: this.apiParams(),
        headers: { 'Content-Type': 'application/json-patch+json' },
      }
    );
    return response.data;
  }

  async getRelationTypes(): Promise<WorkItemRelationType[]> {
    const response = await this.client.get('/_apis/wit/workitemrelationtypes', {
      params: this.apiParams(),
    });
    return response.data.value;
  }

  // ─── Projects ────────────────────────────────────────────────────────────

  async getProjects(): Promise<Project[]> {
    const response = await this.client.get('/_apis/projects', {
      params: this.apiParams(),
    });
    return response.data.value;
  }

  async getProject(name: string): Promise<Project> {
    const response = await this.client.get(`/_apis/projects/${encodeURIComponent(name)}`, {
      params: this.apiParams(),
    });
    return response.data;
  }

  // ─── Teams ───────────────────────────────────────────────────────────────

  async getTeams(project: string): Promise<Team[]> {
    const proj = this.resolveProject(project);
    const response = await this.client.get(
      `/_apis/projects/${encodeURIComponent(proj)}/teams`,
      { params: this.apiParams() }
    );
    return response.data.value;
  }

  async getTeamMembers(project: string, team: string): Promise<TeamMember[]> {
    const proj = this.resolveProject(project);
    const response = await this.client.get(
      `/_apis/projects/${encodeURIComponent(proj)}/teams/${encodeURIComponent(team)}/members`,
      { params: this.apiParams() }
    );
    return response.data.value;
  }

  // ─── Work Item Types ─────────────────────────────────────────────────────

  async getWorkItemTypes(project: string): Promise<WorkItemType[]> {
    const proj = this.resolveProject(project);
    const response = await this.client.get(
      `/${encodeURIComponent(proj)}/_apis/wit/workitemtypes`,
      { params: this.apiParams() }
    );
    return response.data.value;
  }

  // ─── Fields ──────────────────────────────────────────────────────────────

  async getFields(project?: string): Promise<WorkItemFieldDefinition[]> {
    const basePath = project
      ? `/${encodeURIComponent(project)}/_apis/wit/fields`
      : '/_apis/wit/fields';
    const response = await this.client.get(basePath, {
      params: this.apiParams(),
    });
    return response.data.value;
  }

  // ─── Classification Nodes (Areas & Iterations) ──────────────────────────

  async getAreas(project: string, depth: number = 5): Promise<ClassificationNode> {
    const proj = this.resolveProject(project);
    const response = await this.client.get(
      `/${encodeURIComponent(proj)}/_apis/wit/classificationnodes/areas`,
      { params: this.apiParams({ '$depth': String(depth) }) }
    );
    return response.data;
  }

  async getIterations(project: string, depth: number = 5): Promise<ClassificationNode> {
    const proj = this.resolveProject(project);
    const response = await this.client.get(
      `/${encodeURIComponent(proj)}/_apis/wit/classificationnodes/iterations`,
      { params: this.apiParams({ '$depth': String(depth) }) }
    );
    return response.data;
  }

  // ─── History & Revisions ─────────────────────────────────────────────────

  async getWorkItemUpdates(id: number): Promise<WorkItemUpdate[]> {
    const response = await this.client.get(
      `/_apis/wit/workitems/${id}/updates`,
      { params: this.apiParams() }
    );
    return response.data.value;
  }

  async getWorkItemRevisions(id: number): Promise<WorkItem[]> {
    const response = await this.client.get(
      `/_apis/wit/workitems/${id}/revisions`,
      { params: this.apiParams() }
    );
    return response.data.value;
  }

  // ─── Git ───────────────────────────────────────────────────────────────────

  async getRepositories(project?: string): Promise<GitRepository[]> {
    const basePath = project
      ? `/${encodeURIComponent(project)}/_apis/git/repositories`
      : '/_apis/git/repositories';
    const response = await this.client.get(basePath, { params: this.apiParams() });
    return response.data.value;
  }

  async getFileContent(
    repository: string,
    path: string,
    project?: string,
    branch?: string
  ): Promise<string> {
    const proj = this.resolveProject(project);
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const params: Record<string, string> = this.apiParams({
      path: normalizedPath,
      includeContent: 'true',
    });
    if (branch) {
      params['versionDescriptor.version'] = branch;
      params['versionDescriptor.versionType'] = 'branch';
    }
    const response = await this.client.get(
      `/${encodeURIComponent(proj)}/_apis/git/repositories/${encodeURIComponent(repository)}/items`,
      {
        params,
        headers: { Accept: 'text/plain' },
        responseType: 'text',
        transformResponse: [(data) => data],
      }
    );
    return typeof response.data === 'string'
      ? response.data
      : JSON.stringify(response.data, null, 2);
  }

  private searchBaseUrl(): string {
    // Azure DevOps Services routes code search through the almsearch subdomain.
    if (this.orgUrl.includes('://dev.azure.com')) {
      return this.orgUrl.replace('://dev.azure.com', '://almsearch.dev.azure.com');
    }
    return this.orgUrl;
  }

  async searchCode(
    searchText: string,
    project?: string,
    top: number = 25,
    repository?: string
  ): Promise<CodeSearchResult> {
    const proj = this.resolveProject(project);
    const body: Record<string, any> = {
      searchText,
      $skip: 0,
      $top: top,
    };
    if (repository) {
      body.filters = { Repository: [repository] };
    }
    const url = `${this.searchBaseUrl()}/${encodeURIComponent(proj)}/_apis/search/codesearchresults`;
    const response = await this.client.post(url, body, { params: this.apiParams() });
    return response.data;
  }

  // ─── My Work Items ───────────────────────────────────────────────────────

  async getMyWorkItems(
    project?: string,
    types?: string[],
    includeClosed: boolean = false
  ): Promise<WorkItem[]> {
    let wiql =
      'SELECT [System.Id] FROM workitems WHERE [System.AssignedTo] = @Me';
    if (types && types.length > 0) {
      const typeFilter = types.map((t) => `'${t}'`).join(', ');
      wiql += ` AND [System.WorkItemType] IN (${typeFilter})`;
    }
    if (!includeClosed) {
      wiql += " AND [System.State] NOT IN ('Closed', 'Removed', 'Done')";
    }
    wiql += ' ORDER BY [System.ChangedDate] DESC';
    return this.queryWorkItems(wiql, project);
  }

  // ─── Bulk Create ─────────────────────────────────────────────────────────

  async bulkCreateWorkItems(
    items: WorkItemCreateInput[]
  ): Promise<{ created: WorkItem[]; errors: { index: number; title: string; error: string }[] }> {
    const created: WorkItem[] = [];
    const errors: { index: number; title: string; error: string }[] = [];
    for (let i = 0; i < items.length; i++) {
      try {
        const item = await this.createWorkItem(items[i]);
        created.push(item);
      } catch (error: any) {
        errors.push({
          index: i,
          title: items[i].title,
          error: error.response?.data?.message || error.message,
        });
      }
    }
    return { created, errors };
  }

  // ─── PRD → Stories/Tasks hierarchy ─────────────────────────────────────────

  async createHierarchyFromPrd(input: PrdDecompositionInput): Promise<any> {
    const project = this.resolveProject(input.project);

    const feature = await this.createWorkItem({
      project,
      type: input.featureType || 'Feature',
      title: input.featureTitle,
      description: input.featureDescription,
      areaPath: input.areaPath,
      iterationPath: input.iterationPath,
    });

    const stories: any[] = [];
    for (const story of input.stories) {
      const storyItem = await this.createWorkItem({
        project,
        type: input.storyType || 'User Story',
        title: story.title,
        description: story.description,
        acceptanceCriteria: story.acceptanceCriteria,
        storyPoints: story.storyPoints,
        assignedTo: story.assignedTo,
        tags: story.tags,
        areaPath: input.areaPath,
        iterationPath: input.iterationPath,
      });
      await this.linkWorkItems(feature.id, storyItem.id, 'System.LinkTypes.Hierarchy-Forward');

      const tasks: any[] = [];
      for (const task of story.tasks || []) {
        const taskItem = await this.createWorkItem({
          project,
          type: input.taskType || 'Task',
          title: task.title,
          description: task.description,
          assignedTo: task.assignedTo,
          effort: task.effort,
          areaPath: input.areaPath,
          iterationPath: input.iterationPath,
        });
        await this.linkWorkItems(storyItem.id, taskItem.id, 'System.LinkTypes.Hierarchy-Forward');
        tasks.push({ id: taskItem.id, title: task.title });
      }
      stories.push({ id: storyItem.id, title: story.title, tasks });
    }

    return {
      feature: { id: feature.id, title: input.featureTitle },
      stories,
    };
  }

  // ─── Delivery Plans ────────────────────────────────────────────────────────

  async getDeliveryPlans(project?: string): Promise<DeliveryPlan[]> {
    const proj = this.resolveProject(project);
    const response = await this.client.get(
      `/${encodeURIComponent(proj)}/_apis/work/plans`,
      { params: this.apiParams() }
    );
    return response.data.value;
  }

  async getDeliveryPlanTimeline(planId: string, project?: string): Promise<any> {
    const proj = this.resolveProject(project);
    const response = await this.client.get(
      `/${encodeURIComponent(proj)}/_apis/work/plans/${encodeURIComponent(planId)}/deliverytimeline`,
      { params: this.apiParams() }
    );
    return response.data;
  }

  // ─── Attachments ───────────────────────────────────────────────────────────

  async uploadAttachment(
    fileName: string,
    content: Buffer,
    project?: string
  ): Promise<AttachmentReference> {
    const proj = this.resolveProject(project);
    const response = await this.client.post(
      `/${encodeURIComponent(proj)}/_apis/wit/attachments`,
      content,
      {
        params: this.apiParams({ fileName }),
        headers: { 'Content-Type': 'application/octet-stream' },
      }
    );
    return response.data;
  }

  async addAttachment(
    workItemId: number,
    fileName: string,
    content: Buffer,
    project?: string,
    comment?: string
  ): Promise<WorkItem> {
    const attachment = await this.uploadAttachment(fileName, content, project);
    const patchOps: JsonPatchOperation[] = [
      {
        op: 'add',
        path: '/relations/-',
        value: {
          rel: 'AttachedFile',
          url: attachment.url,
          attributes: { name: fileName, comment: comment || '' },
        },
      },
    ];
    const response = await this.client.patch(
      `/_apis/wit/workitems/${workItemId}`,
      patchOps,
      {
        params: this.apiParams(),
        headers: { 'Content-Type': 'application/json-patch+json' },
      }
    );
    return response.data;
  }

  async getAttachments(workItemId: number): Promise<WorkItemAttachment[]> {
    const item = await this.getWorkItem(workItemId, 'Relations');
    return (item.relations || [])
      .filter((r) => r.rel === 'AttachedFile')
      .map((r) => ({
        name: r.attributes?.name,
        url: r.url,
        resourceId: r.url.split('/').pop(),
        comment: r.attributes?.comment,
      }));
  }

  async downloadAttachment(url: string): Promise<Buffer> {
    const response = await this.client.get(url, {
      params: this.apiParams(),
      responseType: 'arraybuffer',
    });
    return Buffer.from(response.data);
  }

  // ─── Test Plans / Suites ─────────────────────────────────────────────────

  async getTestPlans(project?: string): Promise<TestPlan[]> {
    const proj = this.resolveProject(project);
    const response = await this.client.get(
      `/${encodeURIComponent(proj)}/_apis/testplan/plans`,
      { params: this.apiParams() }
    );
    return response.data.value;
  }

  async getTestPlan(planId: number, project?: string): Promise<TestPlan> {
    const proj = this.resolveProject(project);
    const response = await this.client.get(
      `/${encodeURIComponent(proj)}/_apis/testplan/plans/${planId}`,
      { params: this.apiParams() }
    );
    return response.data;
  }

  async getTestSuites(planId: number, project?: string): Promise<TestSuite[]> {
    const proj = this.resolveProject(project);
    const response = await this.client.get(
      `/${encodeURIComponent(proj)}/_apis/testplan/Plans/${planId}/suites`,
      { params: this.apiParams() }
    );
    return response.data.value;
  }

  async addTestCaseToSuite(
    planId: number,
    suiteId: number,
    testCaseId: number,
    project?: string
  ): Promise<any> {
    const proj = this.resolveProject(project);
    const response = await this.client.post(
      `/${encodeURIComponent(proj)}/_apis/testplan/Plans/${planId}/Suites/${suiteId}/TestCase`,
      [{ workItem: { id: testCaseId } }],
      { params: this.apiParams() }
    );
    return response.data;
  }

  async createTestCase(
    title: string,
    steps: TestStep[],
    project?: string,
    options?: {
      areaPath?: string;
      iterationPath?: string;
      priority?: number;
      planId?: number;
      suiteId?: number;
    }
  ): Promise<WorkItem> {
    const proj = this.resolveProject(project);
    const customFields: Record<string, any> = {};
    if (steps && steps.length > 0) {
      customFields['Microsoft.VSTS.TCM.Steps'] = buildStepsXml(steps);
    }
    const testCase = await this.createWorkItem({
      project: proj,
      type: 'Test Case',
      title,
      areaPath: options?.areaPath,
      iterationPath: options?.iterationPath,
      priority: options?.priority,
      customFields,
    });
    if (options?.planId && options?.suiteId) {
      await this.addTestCaseToSuite(options.planId, options.suiteId, testCase.id, proj);
    }
    return testCase;
  }

  // ─── Test Results ──────────────────────────────────────────────────────────

  async addTestResult(
    testCaseId: number,
    outcome: string,
    project?: string,
    options?: { planId?: number; comment?: string; runName?: string; testCaseTitle?: string }
  ): Promise<TestRunResult> {
    const proj = this.resolveProject(project);

    const runBody: Record<string, any> = {
      name: options?.runName || `Ad-hoc run - TC ${testCaseId}`,
      automated: false,
      state: 'InProgress',
    };
    if (options?.planId) {
      runBody.plan = { id: String(options.planId) };
    }
    const runResponse = await this.client.post(
      `/${encodeURIComponent(proj)}/_apis/test/runs`,
      runBody,
      { params: this.apiParams() }
    );
    const run = runResponse.data;

    const resultsResponse = await this.client.post(
      `/${encodeURIComponent(proj)}/_apis/test/runs/${run.id}/results`,
      [
        {
          testCase: { id: testCaseId },
          testCaseTitle: options?.testCaseTitle,
          outcome,
          state: 'Completed',
          comment: options?.comment,
        },
      ],
      { params: this.apiParams() }
    );

    await this.client.patch(
      `/${encodeURIComponent(proj)}/_apis/test/runs/${run.id}`,
      { state: 'Completed' },
      { params: this.apiParams() }
    );

    return { run, results: resultsResponse.data };
  }

  // ─── Bug from Test Failure ─────────────────────────────────────────────────

  async createBugFromTestFailure(input: {
    title: string;
    project?: string;
    testCaseId?: number;
    errorMessage?: string;
    stackTrace?: string;
    steps?: string;
    assignedTo?: string;
    priority?: number;
    severity?: string;
    areaPath?: string;
    iterationPath?: string;
    tags?: string;
  }): Promise<WorkItem> {
    const project = this.resolveProject(input.project);

    const reproParts: string[] = [];
    if (input.steps) reproParts.push(`<b>Steps:</b><br/>${input.steps}`);
    if (input.errorMessage) reproParts.push(`<b>Error:</b><br/><pre>${escapeXml(input.errorMessage)}</pre>`);
    if (input.stackTrace) reproParts.push(`<b>Stack trace:</b><br/><pre>${escapeXml(input.stackTrace)}</pre>`);
    if (input.testCaseId) reproParts.push(`<b>Failed test case:</b> #${input.testCaseId}`);
    const reproSteps = reproParts.join('<br/><br/>') || 'Automated test failure.';

    const bug = await this.createWorkItem({
      project,
      type: 'Bug',
      title: input.title,
      reproSteps,
      assignedTo: input.assignedTo,
      priority: input.priority,
      severity: input.severity,
      areaPath: input.areaPath,
      iterationPath: input.iterationPath,
      tags: input.tags,
    });

    if (input.testCaseId) {
      await this.linkWorkItems(bug.id, input.testCaseId, 'System.LinkTypes.Related', 'Bug filed from test failure');
    }

    return bug;
  }

  // ─── Duplicate Detection ───────────────────────────────────────────────────

  async findDuplicates(
    title: string,
    project?: string,
    types: string[] = ['Bug'],
    top: number = 5,
    includeClosed: boolean = false
  ): Promise<DuplicateCandidate[]> {
    const tokens = tokenize(title);
    if (tokens.length === 0) return [];

    const words = tokens.join(' ').replace(/'/g, "''");
    const typeFilter = types.map((t) => `'${t}'`).join(', ');

    let wiql =
      "SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType], [System.AssignedTo] " +
      `FROM workitems WHERE [System.WorkItemType] IN (${typeFilter}) ` +
      `AND [System.Title] CONTAINS WORDS '${words}'`;
    if (!includeClosed) {
      wiql += " AND [System.State] NOT IN ('Closed', 'Removed', 'Done', 'Resolved')";
    }

    const items = await this.queryWorkItems(wiql, project, Math.max(top * 5, 25));
    const inputSet = new Set(tokens);

    const scored: DuplicateCandidate[] = items.map((item) => {
      const itemTitle = item.fields['System.Title'] || '';
      const score = diceCoefficient(inputSet, new Set(tokenize(itemTitle)));
      const assignedTo = item.fields['System.AssignedTo'];
      return {
        id: item.id,
        title: itemTitle,
        state: item.fields['System.State'],
        type: item.fields['System.WorkItemType'],
        assignedTo: assignedTo && typeof assignedTo === 'object' ? assignedTo.displayName : assignedTo,
        score: Math.round(score * 1000) / 1000,
      };
    });

    return scored
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, top);
  }
}
