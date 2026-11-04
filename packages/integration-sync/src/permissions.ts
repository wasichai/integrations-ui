import { useAuth, type CallerPermissions } from '@wasichai/core'

// same rule as @wasichai/integrations (ADR-0011 of wasichai/integrations): defining and running syncs is
// MANAGE_ORGANIZATION. hiding is a courtesy, the server still refuses everyone else
export function canManageSync(permissions: CallerPermissions | null): boolean {
  return permissions !== null && (permissions.admin || (permissions.capabilities ?? []).includes('MANAGE_ORGANIZATION'))
}

export function useCanManageSync(): boolean {
  return canManageSync(useAuth().permissions)
}
