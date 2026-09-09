// Azure DevOps MCP Server - Shared Types

// ─── Configuration ───────────────────────────────────────────────────────────

export interface AzureDevOpsConfig {
  orgUrl: string;
  personalAccessToken: string;
  defaultProject?: string;
  apiVersion?: string;
}

// ─── JSON Patch (used for create/update operations) ──────────────────────────

export interface JsonPatchOperation {
  op: 'add' | 'replace' | 'remove' | 'test';
  path: string;
  value?: any;
  from?: string;
}

// ─── Work Items ──────────────────────────────────────────────────────────────

export interface WorkItem {
  id: number;
  rev: number;
  fields: WorkItemFields;
  relations?: WorkItemRelation[];
  url: string;
  _links?: Record<string, { href: string }>;
}

export interface WorkItemFields {
  'System.Id'?: number;
  'System.Title'?: string;
  'System.State'?: string;
  'System.Reason'?: string;
  'System.AssignedTo'?: IdentityRef;
  'System.CreatedBy'?: IdentityRef;
  'System.CreatedDate'?: string;
  'System.ChangedBy'?: IdentityRef;
  'System.ChangedDate'?: string;
  'System.Description'?: string;
  'System.WorkItemType'?: string;
  'System.AreaPath'?: string;
  'System.IterationPath'?: string;
  'System.Tags'?: string;
  'System.TeamProject'?: string;
  'System.History'?: string;
  'Microsoft.VSTS.Common.Priority'?: number;
  'Microsoft.VSTS.Common.Severity'?: string;
  'Microsoft.VSTS.Common.ValueArea'?: string;
  'Microsoft.VSTS.Common.Risk'?: string;
  'Microsoft.VSTS.Common.AcceptanceCriteria'?: string;
  'Microsoft.VSTS.Scheduling.StoryPoints'?: number;
  'Microsoft.VSTS.Scheduling.Effort'?: number;
  'Microsoft.VSTS.Scheduling.RemainingWork'?: number;
  'Microsoft.VSTS.Scheduling.OriginalEstimate'?: number;
  'Microsoft.VSTS.Common.ResolvedBy'?: IdentityRef;
  'Microsoft.VSTS.Common.ResolvedDate'?: string;
  'Microsoft.VSTS.Common.ClosedBy'?: IdentityRef;
  'Microsoft.VSTS.Common.ClosedDate'?: string;
  'Microsoft.VSTS.TCM.ReproSteps'?: string;
  'Microsoft.VSTS.Common.Activity'?: string;
  [key: string]: any;
}

export interface WorkItemRelation {
  rel: string;
  url: string;
  attributes: {
    name?: string;
    isLocked?: boolean;
    [key: string]: any;
  };
}

export interface IdentityRef {
  displayName: string;
  url?: string;
  id?: string;
  uniqueName?: string;
  imageUrl?: string;
  descriptor?: string;
}

// ─── Work Item Inputs ────────────────────────────────────────────────────────

export interface WorkItemCreateInput {
  project: string;
  type: string;
  title: string;
  description?: string;
  assignedTo?: string;
  areaPath?: string;
  iterationPath?: string;
  priority?: number;
  severity?: string;
  tags?: string;
  storyPoints?: number;
  effort?: number;
  acceptanceCriteria?: string;
  reproSteps?: string;
  customFields?: Record<string, any>;
}

export interface WorkItemUpdateInput {
  title?: string;
  state?: string;
  reason?: string;
  description?: string;
  assignedTo?: string;
  areaPath?: string;
  iterationPath?: string;
  priority?: number;
  severity?: string;
  tags?: string;
  storyPoints?: number;
  effort?: number;
  acceptanceCriteria?: string;
  reproSteps?: string;
  customFields?: Record<string, any>;
}

// ─── Query ───────────────────────────────────────────────────────────────────

export interface WiqlResult {
  queryType: string;
  queryResultType: string;
  asOf: string;
  columns: WiqlColumn[];
  workItems: WiqlWorkItemRef[];
}

export interface WiqlColumn {
  referenceName: string;
  name: string;
  url: string;
}

export interface WiqlWorkItemRef {
  id: number;
  url: string;
}

// ─── Projects ────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  description?: string;
  url: string;
  state: string;
  revision: number;
  visibility: string;
  lastUpdateTime: string;
}

// ─── Teams ───────────────────────────────────────────────────────────────────

export interface Team {
  id: string;
  name: string;
  description?: string;
  url: string;
  identityUrl: string;
  projectName?: string;
  projectId?: string;
}

export interface TeamMember {
  identity: IdentityRef;
  isTeamAdmin?: boolean;
}

// ─── Work Item Types ─────────────────────────────────────────────────────────

export interface WorkItemType {
  name: string;
  referenceName: string;
  description?: string;
  color?: string;
  icon?: { id: string; url: string };
  isDisabled?: boolean;
  states?: WorkItemStateDefinition[];
  fields?: WorkItemFieldDefinition[];
}

export interface WorkItemStateDefinition {
  name: string;
  color?: string;
  category: string;
}

// ─── Fields ──────────────────────────────────────────────────────────────────

export interface WorkItemFieldDefinition {
  name: string;
  referenceName: string;
  description?: string;
  type: string;
  readOnly?: boolean;
  isIdentity?: boolean;
  isPicklist?: boolean;
  isPicklistSuggested?: boolean;
  supportedOperations?: { referenceName: string; name: string }[];
}

// ─── Classification Nodes (Areas & Iterations) ──────────────────────────────

export interface ClassificationNode {
  id: number;
  identifier: string;
  name: string;
  structureType: 'area' | 'iteration';
  hasChildren: boolean;
  path?: string;
  children?: ClassificationNode[];
  attributes?: {
    startDate?: string;
    finishDate?: string;
    [key: string]: any;
  };
}

// ─── Comments ────────────────────────────────────────────────────────────────

export interface WorkItemComment {
  id: number;
  workItemId: number;
  text: string;
  createdBy: IdentityRef;
  createdDate: string;
  modifiedBy?: IdentityRef;
  modifiedDate?: string;
  version: number;
}

export interface WorkItemCommentList {
  totalCount: number;
  count: number;
  comments: WorkItemComment[];
}

// ─── Work Item Updates (History) ─────────────────────────────────────────────

export interface WorkItemUpdate {
  id: number;
  workItemId: number;
  rev: number;
  revisedBy: IdentityRef;
  revisedDate: string;
  fields?: Record<string, { oldValue?: any; newValue?: any }>;
  relations?: {
    added?: WorkItemRelation[];
    removed?: WorkItemRelation[];
    updated?: WorkItemRelation[];
  };
}

// ─── Relation Types ──────────────────────────────────────────────────────────

export interface WorkItemRelationType {
  name: string;
  referenceName: string;
  attributes: {
    usage: string;
    editable: boolean;
    enabled: boolean;
    acyclic?: boolean;
    directional?: boolean;
    singleTarget?: boolean;
    topology?: string;
  };
}

// ─── API Response Wrappers ───────────────────────────────────────────────────

export interface ListResponse<T> {
  count: number;
  value: T[];
}

// ─── Git ─────────────────────────────────────────────────────────────────────

export interface GitRepository {
  id: string;
  name: string;
  url: string;
  project?: { id: string; name: string };
  defaultBranch?: string;
  size?: number;
  remoteUrl?: string;
  webUrl?: string;
}

export interface CodeSearchResult {
  count: number;
  results: Array<{
    fileName: string;
    path: string;
    repository: { name: string; id: string };
    project: { name: string; id: string };
    versions?: Array<{ branchName: string; changeId: string }>;
    matches?: Record<string, Array<{ charOffset: number; length: number }>>;
  }>;
}

// ─── Delivery Plans ──────────────────────────────────────────────────────────

export interface DeliveryPlan {
  id: string;
  name: string;
  description?: string;
  type?: string;
  createdByIdentity?: IdentityRef;
  modifiedDate?: string;
  url?: string;
}

// ─── Attachments ─────────────────────────────────────────────────────────────

export interface AttachmentReference {
  id: string;
  url: string;
}

export interface WorkItemAttachment {
  name?: string;
  url: string;
  resourceId?: string;
  comment?: string;
}

// ─── Test Plans / Suites / Runs ──────────────────────────────────────────────

export interface TestPlan {
  id: number;
  name: string;
  areaPath?: string;
  iteration?: string;
  state?: string;
  owner?: IdentityRef;
  startDate?: string;
  endDate?: string;
}

export interface TestSuite {
  id: number;
  name: string;
  suiteType?: string;
  parentSuite?: { id: number; name: string };
  plan?: { id: number; name: string };
}

export interface TestStep {
  action: string;
  expected?: string;
}

export interface TestRunResult {
  run: any;
  results: any;
}

// ─── PRD Decomposition ───────────────────────────────────────────────────────

export interface PrdTaskInput {
  title: string;
  description?: string;
  assignedTo?: string;
  effort?: number;
}

export interface PrdStoryInput {
  title: string;
  description?: string;
  acceptanceCriteria?: string;
  storyPoints?: number;
  assignedTo?: string;
  tags?: string;
  tasks?: PrdTaskInput[];
}

export interface PrdDecompositionInput {
  project?: string;
  featureTitle: string;
  featureDescription?: string;
  featureType?: string;
  storyType?: string;
  taskType?: string;
  areaPath?: string;
  iterationPath?: string;
  stories: PrdStoryInput[];
}

// ─── Duplicate Detection ─────────────────────────────────────────────────────

export interface DuplicateCandidate {
  id: number;
  title: string;
  state?: string;
  type?: string;
  assignedTo?: string;
  score: number;
}
