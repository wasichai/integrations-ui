import { Archive, ChartColumn, Boxes, Gauge } from 'lucide-react'
import type { WasichaiModule } from '@wasichai/core'
import { integrationAdminMessages } from './i18n'

export const INTEGRATION_ADMIN_MODULE_ID = 'integration-admin'

export interface IntegrationAdminModuleOptions {
  // url prefix of every route of the module. default sits next to @wasichai/integrations' pages
  basePath?: string
}

// installed connectors and their maturity, the tenant's usage, system health with dead letters, and retention. its
// nav goes in the 'integrations' group, which @wasichai/integrations declares: register that module too. every page
// reads what any member may; retrying jobs and replaying events show only for who may do them
export function integrationAdminModule(options: IntegrationAdminModuleOptions = {}): WasichaiModule {
  return {
    id: INTEGRATION_ADMIN_MODULE_ID,
    basePath: options.basePath ?? 'integrations',
    routes: [
      { id: 'connectors', path: 'admin/connectors', lazy: () => import('./ConnectorsPage').then((m) => ({ default: m.ConnectorsPage })) },
      { id: 'usage', path: 'admin/usage', lazy: () => import('./UsagePage').then((m) => ({ default: m.UsagePage })) },
      { id: 'system', path: 'admin/system', lazy: () => import('./SystemPage').then((m) => ({ default: m.SystemPage })) },
      { id: 'retention', path: 'admin/retention', lazy: () => import('./RetentionPage').then((m) => ({ default: m.RetentionPage })) }
    ],
    // after integrations' (10–30), integration-sync's (40, 50), integration-workflows' (60) and integration-ai's (70–85)
    nav: [
      { group: 'integrations', labelKey: 'integration-admin:nav.connectors', order: 90, icon: Boxes, route: 'connectors' },
      { group: 'integrations', labelKey: 'integration-admin:nav.usage', order: 92, icon: ChartColumn, route: 'usage' },
      { group: 'integrations', labelKey: 'integration-admin:nav.system', order: 94, icon: Gauge, route: 'system' },
      { group: 'integrations', labelKey: 'integration-admin:nav.retention', order: 96, icon: Archive, route: 'retention' }
    ],
    i18n: integrationAdminMessages
  }
}
