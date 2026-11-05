import { Workflow } from 'lucide-react'
import type { WasichaiModule } from '@wasichai/core'
import { integrationWorkflowsMessages } from './i18n'

export const INTEGRATION_WORKFLOWS_MODULE_ID = 'integration-workflows'

export interface IntegrationWorkflowsModuleOptions {
  // url prefix of every route of the module. default sits next to @wasichai/integrations' pages
  basePath?: string
}

// workflows across connections, their versions and runs. its nav goes in the 'integrations' group, which
// @wasichai/integrations declares: register that module too (the connections steps use are its own).
// every route is lazy: xyflow loads only when someone opens the designer
export function integrationWorkflowsModule(options: IntegrationWorkflowsModuleOptions = {}): WasichaiModule {
  return {
    id: INTEGRATION_WORKFLOWS_MODULE_ID,
    basePath: options.basePath ?? 'integrations',
    routes: [
      { id: 'workflows', path: 'workflows', lazy: () => import('./WorkflowsPage').then((m) => ({ default: m.WorkflowsPage })) },
      { id: 'workflow', path: 'workflows/:workflowId', lazy: () => import('./WorkflowPage').then((m) => ({ default: m.WorkflowPage })) },
      { id: 'designer', path: 'workflows/:workflowId/design', lazy: () => import('./DesignerPage').then((m) => ({ default: m.DesignerPage })) },
      { id: 'version', path: 'workflows/:workflowId/versions/:number', lazy: () => import('./VersionPage').then((m) => ({ default: m.VersionPage })) },
      {
        id: 'execution',
        path: 'workflows/:workflowId/executions/:executionId',
        lazy: () => import('./ExecutionPage').then((m) => ({ default: m.ExecutionPage }))
      }
    ],
    // after integrations' entries (10–30) and integration-sync's (40, 50)
    nav: [{ group: 'integrations', labelKey: 'integration-workflows:nav.workflows', order: 60, icon: Workflow, route: 'workflows' }],
    i18n: integrationWorkflowsMessages
  }
}
