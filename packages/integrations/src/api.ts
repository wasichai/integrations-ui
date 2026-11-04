import { infiniteQueryOptions, queryOptions, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@wasichai/core'
import type {
  Connection,
  ConnectionTest,
  Connector,
  CreateConnectionRequest,
  CreateEndpointRequest,
  EventPage,
  Health,
  IntegrationEvent,
  Job,
  OAuthStart,
  OAuthStartRequest,
  ProviderConfig,
  ProviderConfigRequest,
  ResourceDescriptor,
  ResourceSchema,
  VerificationToken,
  WebhookEndpoint
} from './types'

// every key starts with 'integrations'. integration-sync copies the connection and resource keys
// (no package import): change one here and change it there too.
const BASE = '/integrations'
const KEY = 'integrations'

export const EVENTS_PAGE_SIZE = 25

export function connectorsQuery() {
  return queryOptions({
    queryKey: [KEY, 'connectors'],
    queryFn: () => api<Connector[]>(`${BASE}/connectors`)
  })
}

export function connectorQuery(connectorId: string | undefined) {
  return queryOptions({
    queryKey: [KEY, 'connectors', connectorId],
    queryFn: () => api<Connector>(`${BASE}/connectors/${encodeURIComponent(connectorId ?? '')}`),
    enabled: Boolean(connectorId),
    retry: false
  })
}

// 404 = no app registered yet: an answer (null), not an error. admins only, others get a 403
export function providerConfigQuery(connectorId: string | undefined, enabled = true) {
  return queryOptions({
    queryKey: [KEY, 'provider-configs', connectorId],
    queryFn: async () => {
      try {
        return await api<ProviderConfig>(`${BASE}/provider-configs/${encodeURIComponent(connectorId ?? '')}`)
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 404) return null
        throw cause
      }
    },
    enabled: Boolean(connectorId) && enabled,
    retry: false,
    // the form must start from the stored version, or its If-Match is stale
    staleTime: 0
  })
}

// PUT creates or replaces. a replace sends the version it read as If-Match: a 412 means someone saved meanwhile
export function useSaveProviderConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ connectorId, version, request }: { connectorId: string; version: number | null; request: ProviderConfigRequest }) =>
      api<ProviderConfig>(`${BASE}/provider-configs/${encodeURIComponent(connectorId)}`, {
        method: 'PUT',
        headers: version === null ? undefined : { 'If-Match': `"${version}"` },
        body: JSON.stringify(request)
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData([KEY, 'provider-configs', saved.connectorId], saved)
      void queryClient.invalidateQueries({ queryKey: [KEY, 'connectors'] })
    }
  })
}

export function connectionsQuery() {
  return queryOptions({
    queryKey: [KEY, 'connections'],
    queryFn: () => api<Connection[]>(`${BASE}/connections`)
  })
}

export function connectionQuery(connectionId: string | undefined) {
  return queryOptions({
    queryKey: [KEY, 'connections', connectionId],
    queryFn: () => api<Connection>(`${BASE}/connections/${connectionId}`),
    enabled: Boolean(connectionId),
    retry: false
  })
}

// a connection's state shows in the list, its page and the health summary
function useRefreshConnections() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: [KEY, 'connections'] })
    void queryClient.invalidateQueries({ queryKey: [KEY, 'health'] })
  }
}

export function useCreateConnection() {
  const refresh = useRefreshConnections()
  return useMutation({
    mutationFn: (request: CreateConnectionRequest) => api<Connection>(`${BASE}/connections`, { method: 'POST', body: JSON.stringify(request) }),
    onSuccess: refresh
  })
}

// the answer is where to send the browser; the provider sends it back to the connections page
export function useStartOAuth() {
  return useMutation({
    mutationFn: (request: OAuthStartRequest) => api<OAuthStart>(`${BASE}/connections/oauth/start`, { method: 'POST', body: JSON.stringify(request) })
  })
}

export function useTestConnection() {
  const refresh = useRefreshConnections()
  return useMutation({
    mutationFn: (connectionId: string) => api<ConnectionTest>(`${BASE}/connections/${connectionId}/test`, { method: 'POST' }),
    onSuccess: refresh
  })
}

export function useDeleteConnection() {
  const refresh = useRefreshConnections()
  return useMutation({
    mutationFn: (connectionId: string) => api<void>(`${BASE}/connections/${connectionId}`, { method: 'DELETE' }),
    onSuccess: refresh
  })
}

// discovery asks the provider: no retry, a failure is the provider's answer
export function resourcesQuery(connectionId: string | undefined) {
  return queryOptions({
    queryKey: [KEY, 'connections', connectionId, 'resources'],
    queryFn: () => api<ResourceDescriptor[]>(`${BASE}/connections/${connectionId}/resources`),
    enabled: Boolean(connectionId),
    retry: false
  })
}

export function schemaQuery(connectionId: string | undefined, resource: string | undefined) {
  return queryOptions({
    queryKey: [KEY, 'connections', connectionId, 'resources', resource, 'schema'],
    queryFn: () => api<ResourceSchema>(`${BASE}/connections/${connectionId}/resources/${encodeURIComponent(resource ?? '')}/schema`),
    enabled: Boolean(connectionId && resource),
    retry: false
  })
}

export function webhookEndpointsQuery(connectionId: string | undefined) {
  return queryOptions({
    queryKey: [KEY, 'connections', connectionId, 'webhook-endpoints'],
    queryFn: () => api<WebhookEndpoint[]>(`${BASE}/connections/${connectionId}/webhook-endpoints`),
    enabled: Boolean(connectionId)
  })
}

export function useCreateWebhookEndpoint(connectionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: CreateEndpointRequest) =>
      api<WebhookEndpoint>(`${BASE}/connections/${connectionId}/webhook-endpoints`, { method: 'POST', body: JSON.stringify(request) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [KEY, 'connections', connectionId, 'webhook-endpoints'] })
  })
}

// a secret: read on demand, never cached
export function useVerificationToken() {
  return useMutation({
    mutationFn: (endpointId: string) => api<VerificationToken>(`${BASE}/webhook-endpoints/${endpointId}/verification-token`)
  })
}

// keyset pages, newest first. the cursor is the server's, passed back as is
export function eventsQuery(connectionId: string | undefined) {
  return infiniteQueryOptions({
    queryKey: [KEY, 'events', connectionId],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ connectionId: connectionId ?? '', limit: String(EVENTS_PAGE_SIZE) })
      if (pageParam) params.set('cursor', pageParam)
      return api<EventPage>(`${BASE}/events?${params}`)
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: Boolean(connectionId)
  })
}

export function useEvents(connectionId: string | undefined) {
  return useInfiniteQuery(eventsQuery(connectionId))
}

export function useReplayEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (eventId: string) => api<IntegrationEvent>(`${BASE}/events/${eventId}/replay`, { method: 'POST' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [KEY, 'events'] })
  })
}

export function healthQuery() {
  return queryOptions({
    queryKey: [KEY, 'health'],
    queryFn: () => api<Health>(`${BASE}/health`)
  })
}

// admins only: the server answers 403 to anyone else
export function deadJobsQuery(enabled = true) {
  return queryOptions({
    queryKey: [KEY, 'jobs', 'dead'],
    queryFn: () => api<Job[]>(`${BASE}/jobs?status=dead`),
    enabled
  })
}

export function useRetryJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (jobId: string) => api<Job>(`${BASE}/jobs/${jobId}/retry`, { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [KEY, 'jobs'] })
      void queryClient.invalidateQueries({ queryKey: [KEY, 'health'] })
    }
  })
}
