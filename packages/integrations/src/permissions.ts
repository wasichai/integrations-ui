import { useAuth, type CallerPermissions } from '@wasichai/core'

// managing connections, provider apps and webhooks hands out access to another system: MANAGE_ORGANIZATION
// (ADR-0011 of wasichai/integrations). hiding is a courtesy, the server still refuses everyone else
export function canManageIntegrations(permissions: CallerPermissions | null): boolean {
  return permissions !== null && (permissions.admin || (permissions.capabilities ?? []).includes('MANAGE_ORGANIZATION'))
}

export function useCanManageIntegrations(): boolean {
  return canManageIntegrations(useAuth().permissions)
}
