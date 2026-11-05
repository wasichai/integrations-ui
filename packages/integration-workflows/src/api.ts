import { infiniteQueryOptions, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@wasichai/core'
import type {
  ConnectionOption,
  Execution,
  ExecutionDetail,
  ExecutionPage,
  ExecutionStatus,
  Validation,
  WebhookUrl,
  Workflow,
  WorkflowRequest,
  WorkflowVersion,
  WorkflowVersionSummary
} from './types'

const BASE = '/integrations/workflows'
const KEY = 'integration-workflows'
const TERMINAL: ExecutionStatus[] = ['SUCCEEDED', 'FAILED', 'CANCELLED']
// a run going on is polled: steps move without anyone asking
const POLL_MS = 5000

export const isTerminal = (status: ExecutionStatus) => TERMINAL.includes(status)

// same key and path as @wasichai/integrations' connectionsQuery: one cache entry, no package import.
// change it there, change it here
export function connectionOptionsQuery() {
  return queryOptions({
    queryKey: ['integrations', 'connections'],
    queryFn: () => api<ConnectionOption[]>('/integrations/connections')
  })
}

export function workflowsQuery() {
  return queryOptions({
    queryKey: [KEY, 'workflows'],
    queryFn: () => api<Workflow[]>(BASE)
  })
}

export function workflowQuery(workflowId: string | undefined) {
  return queryOptions({
    queryKey: [KEY, 'workflows', workflowId],
    queryFn: () => api<Workflow>(`${BASE}/${workflowId}`),
    enabled: Boolean(workflowId),
    retry: false
  })
}

export function versionsQuery(workflowId: string | undefined) {
  return queryOptions({
    queryKey: [KEY, 'versions', workflowId],
    queryFn: () => api<WorkflowVersionSummary[]>(`${BASE}/${workflowId}/versions`),
    enabled: Boolean(workflowId)
  })
}

export function versionQuery(workflowId: string | undefined, number: string | undefined) {
  return queryOptions({
    queryKey: [KEY, 'versions', workflowId, number],
    queryFn: () => api<WorkflowVersion>(`${BASE}/${workflowId}/versions/${number}`),
    enabled: Boolean(workflowId && number),
    retry: false
  })
}

// newest first, cursor paged. null status is every run
export function executionsQuery(workflowId: string | undefined, status: ExecutionStatus | null) {
  return infiniteQueryOptions({
    queryKey: [KEY, 'executions', workflowId, status],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '50' })
      if (status) params.set('status', status)
      if (pageParam) params.set('cursor', pageParam)
      return api<ExecutionPage>(`${BASE}/${workflowId}/executions?${params}`)
    },
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    enabled: Boolean(workflowId)
  })
}

export function executionQuery(executionId: string | undefined) {
  return queryOptions({
    queryKey: [KEY, 'execution', executionId],
    queryFn: () => api<ExecutionDetail>(`${BASE}/executions/${executionId}`),
    enabled: Boolean(executionId),
    retry: false,
    refetchInterval: (query) => (query.state.data && !isTerminal(query.state.data.execution.status) ? POLL_MS : false)
  })
}

function useRefresh() {
  const queryClient = useQueryClient()
  return () => void queryClient.invalidateQueries({ queryKey: [KEY] })
}

// POST creates a DRAFT
export function useCreateWorkflow() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (request: WorkflowRequest) => api<Workflow>(BASE, { method: 'POST', body: JSON.stringify(request) }),
    onSuccess: refresh
  })
}

// PUT replaces the draft read, with its version as If-Match (412 = saved meanwhile)
export function useSaveWorkflow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, version, request }: { id: string; version: number; request: WorkflowRequest }) =>
      api<Workflow>(`${BASE}/${id}`, { method: 'PUT', headers: { 'If-Match': `"${version}"` }, body: JSON.stringify(request) }),
    onSuccess: (saved) => {
      queryClient.setQueryData([KEY, 'workflows', saved.id], saved)
      void queryClient.invalidateQueries({ queryKey: [KEY, 'workflows'], exact: true })
    }
  })
}

export function useDeleteWorkflow() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (workflowId: string) => api<void>(`${BASE}/${workflowId}`, { method: 'DELETE' }),
    onSuccess: refresh
  })
}

// the stored draft: save first
export function useValidateWorkflow() {
  return useMutation({
    mutationFn: (workflowId: string) => api<Validation>(`${BASE}/${workflowId}/validate`, { method: 'POST' })
  })
}

// 422 violations, 409 already published, 412 the draft moved
export function usePublishWorkflow() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: ({ workflowId, version }: { workflowId: string; version: number }) =>
      api<WorkflowVersion>(`${BASE}/${workflowId}/publish`, { method: 'POST', headers: { 'If-Match': `"${version}"` } }),
    onSuccess: refresh
  })
}

// 409 when not published or paused
export function useRunWorkflow() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: ({ workflowId, payload }: { workflowId: string; payload: Record<string, unknown> | null }) =>
      api<Execution>(`${BASE}/${workflowId}/run`, { method: 'POST', body: JSON.stringify(payload ? { payload } : {}) }),
    onSuccess: refresh
  })
}

export function useSetPaused() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: ({ workflowId, paused }: { workflowId: string; paused: boolean }) =>
      api<Workflow>(`${BASE}/${workflowId}/${paused ? 'pause' : 'resume'}`, { method: 'POST' }),
    onSuccess: refresh
  })
}

// a new secret url; the previous one stops working. never cached: it is shown once
export function useIssueWebhook() {
  return useMutation({
    mutationFn: (workflowId: string) => api<WebhookUrl>(`${BASE}/${workflowId}/webhook`, { method: 'POST' })
  })
}

function useStoreExecution() {
  const queryClient = useQueryClient()
  return (detail: ExecutionDetail) => {
    queryClient.setQueryData([KEY, 'execution', detail.execution.id], detail)
    void queryClient.invalidateQueries({ queryKey: [KEY, 'executions'] })
  }
}

export function useCancelExecution() {
  const store = useStoreExecution()
  return useMutation({
    mutationFn: (executionId: string) => api<ExecutionDetail>(`${BASE}/executions/${executionId}/cancel`, { method: 'POST' }),
    onSuccess: store
  })
}

export function useDecideApproval() {
  const store = useStoreExecution()
  return useMutation({
    mutationFn: ({ executionId, stepId, approve, comment }: { executionId: string; stepId: string; approve: boolean; comment: string }) =>
      api<ExecutionDetail>(`${BASE}/executions/${executionId}/steps/${encodeURIComponent(stepId)}/${approve ? 'approve' : 'reject'}`, {
        method: 'POST',
        body: JSON.stringify(comment.trim() ? { comment: comment.trim() } : {})
      }),
    onSuccess: store
  })
}
