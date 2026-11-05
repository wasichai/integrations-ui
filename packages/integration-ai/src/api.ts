import { infiniteQueryOptions, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@wasichai/core'
import type { ConnectionOption, ConnectorOption, ExecutionPage, ExecutionStatus, ResourceOption, Tool, ToolExecution, ToolRequest } from './types'

const BASE = '/integrations/ai'
const KEY = 'integration-ai'
// a running execution is polled: it ends without anyone asking
const POLL_MS = 5000

// same keys, paths and retry as @wasichai/integrations' connectionsQuery, connectorQuery and resourcesQuery:
// one cache entry, no package import. change them there, change them here
export function connectionOptionsQuery() {
  return queryOptions({
    queryKey: ['integrations', 'connections'],
    queryFn: () => api<ConnectionOption[]>('/integrations/connections')
  })
}

export function connectorOptionQuery(connectorId: string | undefined) {
  return queryOptions({
    queryKey: ['integrations', 'connectors', connectorId],
    queryFn: () => api<ConnectorOption>(`/integrations/connectors/${encodeURIComponent(connectorId ?? '')}`),
    enabled: Boolean(connectorId),
    retry: false
  })
}

export function resourceOptionsQuery(connectionId: string | undefined) {
  return queryOptions({
    queryKey: ['integrations', 'connections', connectionId, 'resources'],
    queryFn: () => api<ResourceOption[]>(`/integrations/connections/${connectionId}/resources`),
    enabled: Boolean(connectionId),
    retry: false
  })
}

// a manager reads every tool, anyone else the enabled ones a role of theirs may call
export function toolsQuery() {
  return queryOptions({
    queryKey: [KEY, 'tools'],
    queryFn: () => api<Tool[]>(`${BASE}/tools`)
  })
}

export function toolQuery(name: string | undefined) {
  return queryOptions({
    queryKey: [KEY, 'tools', name],
    queryFn: () => api<Tool>(`${BASE}/tools/${encodeURIComponent(name ?? '')}`),
    enabled: Boolean(name),
    retry: false
  })
}

// newest first, cursor paged. a manager reads all, anyone else their own
export function executionsQuery(status: ExecutionStatus | null, tool: string | null) {
  return infiniteQueryOptions({
    queryKey: [KEY, 'executions', status, tool],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '50' })
      if (status) params.set('status', status)
      if (tool) params.set('tool', tool)
      if (pageParam) params.set('cursor', pageParam)
      return api<ExecutionPage>(`${BASE}/executions?${params}`)
    },
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor
  })
}

export function executionQuery(executionId: string | undefined) {
  return queryOptions({
    queryKey: [KEY, 'execution', executionId],
    queryFn: () => api<ToolExecution>(`${BASE}/executions/${executionId}`),
    enabled: Boolean(executionId),
    retry: false,
    refetchInterval: (query) => (query.state.data?.status === 'RUNNING' ? POLL_MS : false)
  })
}

function useRefresh() {
  const queryClient = useQueryClient()
  return () => void queryClient.invalidateQueries({ queryKey: [KEY] })
}

export function useCreateTool() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (request: ToolRequest) => api<Tool>(`${BASE}/tools`, { method: 'POST', body: JSON.stringify(request) }),
    onSuccess: refresh
  })
}

// PUT replaces the whole tool read, with its version as If-Match (412 = changed meanwhile). it may rename it
export function useSaveTool() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: ({ name, version, request }: { name: string; version: number; request: ToolRequest }) =>
      api<Tool>(`${BASE}/tools/${encodeURIComponent(name)}`, { method: 'PUT', headers: { 'If-Match': `"${version}"` }, body: JSON.stringify(request) }),
    onSuccess: refresh
  })
}

// its executions stay
export function useDeleteTool() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api<void>(`${BASE}/tools/${encodeURIComponent(name)}`, { method: 'DELETE' }),
    onSuccess: (_, name) => {
      queryClient.removeQueries({ queryKey: [KEY, 'tools', name] })
      void queryClient.invalidateQueries({ queryKey: [KEY, 'tools'], exact: true })
    }
  })
}

// 200 ran (SUCCEEDED or FAILED), 202 waits for approval: the body's status says which
export function useExecuteTool() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ name, input }: { name: string; input: unknown }) =>
      api<ToolExecution>(`${BASE}/tools/${encodeURIComponent(name)}/execute`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [KEY, 'executions'] })
  })
}

function useStoreExecution() {
  const queryClient = useQueryClient()
  return (execution: ToolExecution) => {
    queryClient.setQueryData([KEY, 'execution', execution.id], execution)
    void queryClient.invalidateQueries({ queryKey: [KEY, 'executions'] })
  }
}

// 409 when no longer pending, or the tool was deleted, disabled or changed since the call
export function useApproveExecution() {
  const store = useStoreExecution()
  return useMutation({
    mutationFn: (executionId: string) => api<ToolExecution>(`${BASE}/executions/${executionId}/approve`, { method: 'POST' }),
    onSuccess: store
  })
}

export function useRejectExecution() {
  const store = useStoreExecution()
  return useMutation({
    mutationFn: ({ executionId, reason }: { executionId: string; reason: string }) =>
      api<ToolExecution>(`${BASE}/executions/${executionId}/reject`, {
        method: 'POST',
        body: JSON.stringify(reason.trim() ? { reason: reason.trim() } : {})
      }),
    onSuccess: store
  })
}
