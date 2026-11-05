// workflow shapes. mirror the views of wasichai-integrations-workflows (/api/integrations/workflows): cast, not parsed.

export type WorkflowStatus = 'DRAFT' | 'PUBLISHED'

export type TriggerType = 'event' | 'webhook' | 'schedule' | 'manual'

export type StepType = 'action' | 'condition' | 'branch' | 'parallel' | 'delay' | 'approval' | 'end'

export type WriteOperation = 'create' | 'update' | 'upsert' | 'delete'

// {"ref": "trigger.payload.email"} or {"value": <json>}: exactly one key
export type Operand = { ref: string } | { value: unknown }

export type LeafOp = 'equals' | 'notEquals' | 'exists' | 'in' | 'gt' | 'lt'

export type ConditionOp = LeafOp | 'and' | 'or' | 'not'

// the closed condition set. a draft may hold it half built, so every key is optional
export interface Condition {
  op?: ConditionOp
  ref?: string
  value?: unknown
  values?: unknown[]
  conditions?: Condition[]
  condition?: Condition
}

export interface Trigger {
  type?: TriggerType
  next?: string
  connectionId?: string
  eventType?: string
  cron?: string
  zone?: string
}

export interface ResourceWrite {
  resource?: string
  operation?: WriteOperation
  recordId?: Operand
  externalIdField?: string
  externalId?: Operand
}

// one node of the graph, as the editor holds it: every key of every type, all optional. the server
// checks the shape on validate; the draft round-trips whatever it is handed
export interface Step {
  id: string
  type: StepType
  onError?: string
  next?: string
  // branch
  condition?: Condition
  then?: string
  else?: string
  // parallel
  branches?: string[]
  join?: string
  // action
  connectionId?: string
  action?: string
  write?: ResourceWrite
  input?: Record<string, Operand>
  // delay
  duration?: string
  // approval
  title?: string
  timeout?: string
  rejected?: string
}

export interface WorkflowGraph {
  trigger?: Trigger
  steps?: Step[]
}

export interface Workflow {
  id: string
  name: string
  status: WorkflowStatus
  // the draft. {} for a workflow created without one
  graph: WorkflowGraph
  // null until the first publish
  publishedVersion: number | null
  // the draft differs from the published version (always true before the first publish)
  unpublishedChanges: boolean
  paused: boolean
  // the ETag: PUT sends it as If-Match
  version: number
  createdAt: string
  updatedAt: string
}

export interface WorkflowRequest {
  name: string
  graph: WorkflowGraph
}

export interface WorkflowVersionSummary {
  number: number
  publishedAt: string
  publishedBy: string | null
}

export interface WorkflowVersion {
  workflowId: string
  number: number
  graph: WorkflowGraph
  publishedAt: string
  publishedBy: string | null
}

export interface Violation {
  field: string
  message: string
}

export interface Validation {
  valid: boolean
  errors: Violation[]
}

export type ExecutionStatus = 'QUEUED' | 'RUNNING' | 'WAITING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'

export type StepStatus = 'PENDING' | 'RUNNING' | 'WAITING' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED'

export interface Execution {
  id: string
  workflowId: string
  // the published version the run is pinned to
  version: number
  status: ExecutionStatus
  triggerType: TriggerType
  // {type, payload, ...}: what trigger.<path> refs read
  trigger: Record<string, unknown>
  correlationId: string
  startedBy: string | null
  // names the failing step
  error: string | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
}

export interface StepExecution {
  stepId: string
  type: StepType
  status: StepStatus
  attempt: number
  input: unknown
  output: unknown
  error: string | null
  // a delay's due time or an approval's timeout
  waitUntil: string | null
  decidedBy: string | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
}

export interface ExecutionDetail {
  execution: Execution
  // in the order the run reached them; a step never reached has no row
  steps: StepExecution[]
}

export interface ExecutionPage {
  content: Execution[]
  nextCursor: string | null
}

export interface WebhookUrl {
  // null while the server has no public base url
  url: string | null
  // holds the secret: shown once, only now
  path: string
}

// what this module reads of the integrations module: its connection list.
// the full shape belongs to @wasichai/integrations, which this package never imports
export interface ConnectionOption {
  id: string
  connectorId: string
  name: string
  status: string
}
