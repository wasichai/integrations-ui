import type { WasichaiModule } from '@wasichai/core'
import type { Execution, ExecutionDetail, StepExecution, Workflow } from '../types'

// what @wasichai/integrations declares, without importing it: the group this module fills
export const integrationsGroup: WasichaiModule = { id: 'integrations', navGroups: [{ id: 'integrations', labelKey: 'integrations:nav.group', order: 45 }] }

export const member = { admin: false, objects: {}, capabilities: [] }

export const workflow = (overrides: Partial<Workflow> = {}): Workflow => ({
  id: 'w1',
  name: 'Leads to CRM',
  status: 'PUBLISHED',
  graph: {
    trigger: { type: 'event', connectionId: 'c1', eventType: 'message.created', next: 'check' },
    steps: [
      { id: 'check', type: 'condition', condition: { op: 'exists', ref: 'trigger.payload.email' }, next: 'upsert' },
      {
        id: 'upsert',
        type: 'action',
        connectionId: 'c2',
        write: { resource: 'contacts', operation: 'upsert', externalIdField: 'extId', externalId: { ref: 'trigger.payload.id' } },
        input: { email: { ref: 'trigger.payload.email' } },
        next: 'done',
        onError: 'done'
      },
      { id: 'done', type: 'end' }
    ]
  },
  publishedVersion: 2,
  unpublishedChanges: false,
  paused: false,
  version: 7,
  createdAt: '2026-11-04T10:00:00Z',
  updatedAt: '2026-11-05T10:00:00Z',
  ...overrides
})

export const execution = (overrides: Partial<Execution> = {}): Execution => ({
  id: 'e1',
  workflowId: 'w1',
  version: 2,
  status: 'WAITING',
  triggerType: 'manual',
  trigger: { type: 'manual', payload: { email: 'ana@example.com' } },
  correlationId: 'corr-1',
  startedBy: 'u1',
  error: null,
  createdAt: '2026-11-05T10:00:00Z',
  startedAt: '2026-11-05T10:00:01Z',
  finishedAt: null,
  ...overrides
})

export const stepRun = (overrides: Partial<StepExecution> = {}): StepExecution => ({
  stepId: 'check',
  type: 'condition',
  status: 'SUCCEEDED',
  attempt: 1,
  input: null,
  output: { result: true },
  error: null,
  waitUntil: null,
  decidedBy: null,
  createdAt: '2026-11-05T10:00:01Z',
  startedAt: '2026-11-05T10:00:01Z',
  finishedAt: '2026-11-05T10:00:02Z',
  ...overrides
})

export const detail = (overrides: Partial<Execution> = {}, steps?: StepExecution[]): ExecutionDetail => ({
  execution: execution(overrides),
  steps: steps ?? [
    stepRun(),
    stepRun({ stepId: 'upsert', type: 'action', status: 'FAILED', attempt: 3, input: { email: 'ana@example.com' }, output: null, error: 'RateLimited' }),
    stepRun({ stepId: 'ok', type: 'approval', status: 'WAITING', output: null, waitUntil: '2099-01-01T00:00:00Z', finishedAt: null })
  ]
})
