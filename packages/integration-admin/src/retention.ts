// the purge tasks and their default ages, as wasichai/integrations documents them (operations guide › Retention,
// ADR-0029); key names their i18n entry. server properties with no read api: what a server overrides cannot be shown
export const RETENTION_TASKS = [
  { task: 'events', key: 'events', days: 30, module: 'integrations' },
  { task: 'jobs', key: 'jobs', days: 30, module: 'integrations' },
  { task: 'usage', key: 'usage', days: 400, module: 'integrations' },
  { task: 'sync.runs', key: 'syncRuns', days: 90, module: 'sync' },
  { task: 'sync.conflicts', key: 'syncConflicts', days: 180, module: 'sync' },
  { task: 'workflows.executions', key: 'workflowExecutions', days: 90, module: 'workflows' },
  { task: 'ai.executions', key: 'aiExecutions', days: 180, module: 'ai' }
] as const

// the purge's own settings under wasichai.integrations.retention (IntegrationsProperties.Retention)
export const RETENTION_SETTINGS = [
  { property: 'enabled', value: 'true' },
  { property: 'interval', value: '1h' },
  { property: 'initial-delay', value: '5m' },
  { property: 'batch-size', value: '1000' },
  { property: 'max-batches', value: '100' }
] as const

export const OPERATIONS_GUIDE = 'https://github.com/wasichai/integrations/blob/main/docs/guides/operations.md'
