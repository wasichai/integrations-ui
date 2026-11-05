import { infiniteQueryOptions, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@wasichai/core'
import type { ConnectionOption, Connector, EventPage, Health, IntegrationEvent, Job, JobStatus, UsageRow } from './types'

const BASE = '/integrations'
const KEY = 'integration-admin'

// same keys and paths as @wasichai/integrations' connectorsQuery, connectionsQuery and healthQuery: one cache entry,
// no package import. change them there, change them here
export function connectorsQuery() {
  return queryOptions({
    queryKey: ['integrations', 'connectors'],
    queryFn: () => api<Connector[]>(`${BASE}/connectors`)
  })
}

export function connectionOptionsQuery() {
  return queryOptions({
    queryKey: ['integrations', 'connections'],
    queryFn: () => api<ConnectionOption[]>(`${BASE}/connections`)
  })
}

export function healthQuery() {
  return queryOptions({
    queryKey: ['integrations', 'health'],
    queryFn: () => api<Health>(`${BASE}/health`)
  })
}

// UTC days, both inclusive. metric null: every metric
export function usageQuery(from: string, to: string, metric: string | null, enabled = true) {
  return queryOptions({
    queryKey: [KEY, 'usage', from, to, metric],
    queryFn: () => {
      const params = new URLSearchParams({ from, to })
      if (metric) params.set('metric', metric)
      return api<UsageRow[]>(`${BASE}/usage?${params}`)
    },
    enabled
  })
}

// managers only: the server answers 403 to anyone else. most recently updated first, no cursor: limit grows instead
export function jobsQuery(status: JobStatus | null, kind: string | null, limit: number, enabled = true) {
  return queryOptions({
    queryKey: [KEY, 'jobs', status, kind, limit],
    queryFn: () => {
      const params = new URLSearchParams({ limit: String(limit) })
      if (status) params.set('status', status)
      if (kind) params.set('kind', kind)
      return api<Job[]>(`${BASE}/jobs?${params}`)
    },
    enabled
  })
}

// failed events of every connection, newest first, cursor paged
export function failedEventsQuery() {
  return infiniteQueryOptions({
    queryKey: [KEY, 'events', 'FAILED'],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ status: 'FAILED', limit: '25' })
      if (pageParam) params.set('cursor', pageParam)
      return api<EventPage>(`${BASE}/events?${params}`)
    },
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor
  })
}

// a retry or replay changes what @wasichai/integrations shows too: refresh its keys as well
function useRefresh(...keys: string[][]) {
  const queryClient = useQueryClient()
  return () => {
    for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey })
  }
}

// 409 unless DEAD
export function useRetryJob() {
  const refresh = useRefresh([KEY, 'jobs'], ['integrations', 'jobs'], ['integrations', 'health'])
  return useMutation({
    mutationFn: (jobId: string) => api<Job>(`${BASE}/jobs/${jobId}/retry`, { method: 'POST' }),
    onSuccess: refresh
  })
}

// 409 when already waiting
export function useReplayEvent() {
  const refresh = useRefresh([KEY, 'events'], ['integrations', 'events'])
  return useMutation({
    mutationFn: (eventId: string) => api<IntegrationEvent>(`${BASE}/events/${eventId}/replay`, { method: 'POST' }),
    onSuccess: refresh
  })
}
