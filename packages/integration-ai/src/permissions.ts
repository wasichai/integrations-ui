import { useAuth, type CallerPermissions } from '@wasichai/core'

// same rule as @wasichai/integrations (ADR-0011 of wasichai/integrations): exposing, changing and deleting tools and
// deciding approvals is MANAGE_ORGANIZATION. hiding is a courtesy, the server still refuses
export function canManageTools(permissions: CallerPermissions | null): boolean {
  return permissions !== null && (permissions.admin || (permissions.capabilities ?? []).includes('MANAGE_ORGANIZATION'))
}

export function useCanManageTools(): boolean {
  return canManageTools(useAuth().permissions)
}
