import { useAuth, type CallerPermissions } from '@wasichai/core'

// same rule as @wasichai/integrations (ADR-0011 of wasichai/integrations): listing and retrying jobs and replaying
// events is MANAGE_ORGANIZATION. hiding is a courtesy, the server still refuses
export function canManageIntegrations(permissions: CallerPermissions | null): boolean {
  return permissions !== null && (permissions.admin || (permissions.capabilities ?? []).includes('MANAGE_ORGANIZATION'))
}

export function useCanManageIntegrations(): boolean {
  return canManageIntegrations(useAuth().permissions)
}
