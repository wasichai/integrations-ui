import type { AuthType, Capability, ConnectionStatus, JobStatus, Maturity } from './types'

// the closed sets of the backend's views, in display order
export const CAPABILITIES: Capability[] = ['AUTHENTICATION', 'DISCOVERY', 'READ', 'CHANGE_FEED', 'WRITE', 'UPSERT', 'WEBHOOKS', 'ACTIONS']
export const MATURITIES: Maturity[] = ['TESTED', 'IMPLEMENTED', 'DECLARED']
export const AUTH_TYPES: AuthType[] = ['OAUTH2_AUTHORIZATION_CODE', 'OAUTH2_CLIENT_CREDENTIALS', 'API_KEY', 'BASIC']
export const CONNECTION_STATUSES: ConnectionStatus[] = ['ACTIVE', 'NEEDS_REAUTH', 'ERROR', 'DISABLED']
export const JOB_STATUSES: JobStatus[] = ['PENDING', 'RUNNING', 'SUCCEEDED', 'DEAD']
