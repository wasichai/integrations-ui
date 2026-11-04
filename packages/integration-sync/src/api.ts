import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@wasichai/core'
import type {
  Conflict,
  ConflictStatus,
  ConnectionOption,
  ResolveRequest,
  ResourceOption,
  ResourceSchemaOption,
  RunKind,
  SyncDefinition,
  SyncDefinitionRequest,
  SyncRun,
  Validation
} from './types'

const BASE = '/integrations'
const KEY = 'integration-sync'

// same keys, paths and retry as @wasichai/integrations' connectionsQuery, resourcesQuery and schemaQuery:
// one cache entry, no package import. change them there, change them here
export function connectionOptionsQuery() {
  return queryOptions({
    queryKey: ['integrations', 'connections'],
    queryFn: () => api<ConnectionOption[]>(`${BASE}/connections`)
  })
}

export function resourceOptionsQuery(connectionId: string | null | undefined) {
  return queryOptions({
    queryKey: ['integrations', 'connections', connectionId ?? undefined, 'resources'],
    queryFn: () => api<ResourceOption[]>(`${BASE}/connections/${connectionId}/resources`),
    enabled: Boolean(connectionId),
    retry: false
  })
}

export function schemaOptionsQuery(connectionId: string | null | undefined, resource: string | null | undefined) {
  return queryOptions({
    queryKey: ['integrations', 'connections', connectionId ?? undefined, 'resources', resource ?? undefined, 'schema'],
    queryFn: () => api<ResourceSchemaOption>(`${BASE}/connections/${connectionId}/resources/${encodeURIComponent(resource ?? '')}/schema`),
    enabled: Boolean(connectionId && resource),
    retry: false
  })
}

export function definitionsQuery() {
  return queryOptions({
    queryKey: [KEY, 'definitions'],
    queryFn: () => api<SyncDefinition[]>(`${BASE}/sync-definitions`)
  })
}

export function definitionQuery(definitionId: string | undefined) {
  return queryOptions({
    queryKey: [KEY, 'definitions', definitionId],
    queryFn: () => api<SyncDefinition>(`${BASE}/sync-definitions/${definitionId}`),
    enabled: Boolean(definitionId),
    retry: false
  })
}

export function runsQuery(definitionId: string | undefined) {
  return queryOptions({
    queryKey: [KEY, 'runs', definitionId],
    queryFn: () => api<SyncRun[]>(`${BASE}/sync-definitions/${definitionId}/runs?limit=50`),
    enabled: Boolean(definitionId)
  })
}

export function conflictsQuery(status: ConflictStatus, definitionId?: string | null) {
  return queryOptions({
    queryKey: [KEY, 'conflicts', status, definitionId ?? null],
    queryFn: () => {
      const params = new URLSearchParams({ status, limit: '200' })
      if (definitionId) params.set('definitionId', definitionId)
      return api<Conflict[]>(`${BASE}/conflicts?${params}`)
    }
  })
}

function useRefreshDefinitions() {
  const queryClient = useQueryClient()
  return () => void queryClient.invalidateQueries({ queryKey: [KEY] })
}

// POST creates a DRAFT; PUT replaces the one read, with its version as If-Match (412 = saved meanwhile)
export function useSaveDefinition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, version, request }: { id: string | null; version: number | null; request: SyncDefinitionRequest }) =>
      api<SyncDefinition>(id ? `${BASE}/sync-definitions/${id}` : `${BASE}/sync-definitions`, {
        method: id ? 'PUT' : 'POST',
        headers: id && version !== null ? { 'If-Match': `"${version}"` } : undefined,
        body: JSON.stringify(request)
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData([KEY, 'definitions', saved.id], saved)
      void queryClient.invalidateQueries({ queryKey: [KEY, 'definitions'], exact: true })
    }
  })
}

// against the live schemas of both sides: what activate would refuse
export function useValidateDefinition() {
  return useMutation({
    mutationFn: (definitionId: string) => api<Validation>(`${BASE}/sync-definitions/${definitionId}/validate`, { method: 'POST' })
  })
}

export function useSetDefinitionActive() {
  const refresh = useRefreshDefinitions()
  return useMutation({
    mutationFn: ({ definitionId, active }: { definitionId: string; active: boolean }) =>
      api<SyncDefinition>(`${BASE}/sync-definitions/${definitionId}/${active ? 'activate' : 'deactivate'}`, { method: 'POST' }),
    onSuccess: refresh
  })
}

export function useRunDefinition() {
  const refresh = useRefreshDefinitions()
  return useMutation({
    mutationFn: ({ definitionId, kind }: { definitionId: string; kind: RunKind }) =>
      api<{ runId: string }>(`${BASE}/sync-definitions/${definitionId}/run`, { method: 'POST', body: JSON.stringify({ kind }) }),
    onSuccess: refresh
  })
}

export function useDeleteDefinition() {
  const refresh = useRefreshDefinitions()
  return useMutation({
    mutationFn: (definitionId: string) => api<void>(`${BASE}/sync-definitions/${definitionId}`, { method: 'DELETE' }),
    onSuccess: refresh
  })
}

export function useResolveConflict() {
  const refresh = useRefreshDefinitions()
  return useMutation({
    mutationFn: ({ conflictId, request }: { conflictId: string; request: ResolveRequest }) =>
      api<Conflict>(`${BASE}/conflicts/${conflictId}/resolve`, { method: 'POST', body: JSON.stringify(request) }),
    onSuccess: refresh
  })
}
