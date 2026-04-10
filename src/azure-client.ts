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
} from './types.js';

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
}
