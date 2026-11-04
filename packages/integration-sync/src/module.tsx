import { ArrowLeftRight, GitCompare } from 'lucide-react'
import type { WasichaiModule } from '@wasichai/core'
import { integrationSyncMessages } from './i18n'

export const INTEGRATION_SYNC_MODULE_ID = 'integration-sync'

export interface IntegrationSyncModuleOptions {
  // url prefix of every route of the module. default sits next to @wasichai/integrations' pages
  basePath?: string
}

// sync definitions, their runs and conflicts. its nav goes in the 'integrations' group, which
// @wasichai/integrations declares: register that module too (the connections it pairs are its own).
// index.ts exports the pages too; the lazy routes are what keep them out of an app's first bundle
export function integrationSyncModule(options: IntegrationSyncModuleOptions = {}): WasichaiModule {
  return {
    id: INTEGRATION_SYNC_MODULE_ID,
    basePath: options.basePath ?? 'integrations',
    routes: [
      { id: 'definitions', path: 'sync-definitions', lazy: () => import('./DefinitionsPage').then((m) => ({ default: m.DefinitionsPage })) },
      {
        id: 'newDefinition',
        path: 'sync-definitions/new',
        lazy: () => import('./DefinitionWizardPage').then((m) => ({ default: m.DefinitionWizardPage }))
      },
      { id: 'definition', path: 'sync-definitions/:definitionId', lazy: () => import('./DefinitionPage').then((m) => ({ default: m.DefinitionPage })) },
      {
        id: 'editDefinition',
        path: 'sync-definitions/:definitionId/edit',
        lazy: () => import('./DefinitionWizardPage').then((m) => ({ default: m.DefinitionWizardPage }))
      },
      { id: 'conflicts', path: 'conflicts', lazy: () => import('./ConflictsPage').then((m) => ({ default: m.ConflictsPage })) }
    ],
    // after integrations' catalog (10), connections (20) and health (30)
    nav: [
      { group: 'integrations', labelKey: 'integration-sync:nav.definitions', order: 40, icon: ArrowLeftRight, route: 'definitions' },
      { group: 'integrations', labelKey: 'integration-sync:nav.conflicts', order: 50, icon: GitCompare, route: 'conflicts' }
    ],
    i18n: integrationSyncMessages
  }
}
