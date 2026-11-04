import { Activity, Cable, Plug } from 'lucide-react'
import type { WasichaiModule } from '@wasichai/core'
import { integrationsMessages } from './i18n'

export const INTEGRATIONS_MODULE_ID = 'integrations'

export interface IntegrationsModuleOptions {
  // url prefix of every route of the module. the oauth return url of the backend points at its connections page
  basePath?: string
}

// catalog, connections and health. index.ts exports the pages too, for an app that routes them itself;
// the lazy routes are what keep them out of an app's first bundle
export function integrationsModule(options: IntegrationsModuleOptions = {}): WasichaiModule {
  return {
    id: INTEGRATIONS_MODULE_ID,
    basePath: options.basePath ?? 'integrations',
    routes: [
      { id: 'catalog', path: 'connectors', lazy: () => import('./CatalogPage').then((m) => ({ default: m.CatalogPage })) },
      { id: 'connector', path: 'connectors/:connectorId', lazy: () => import('./ConnectorPage').then((m) => ({ default: m.ConnectorPage })) },
      { id: 'connections', path: 'connections', lazy: () => import('./ConnectionsPage').then((m) => ({ default: m.ConnectionsPage })) },
      { id: 'connection', path: 'connections/:connectionId', lazy: () => import('./ConnectionPage').then((m) => ({ default: m.ConnectionPage })) },
      { id: 'health', path: 'health', lazy: () => import('./HealthPage').then((m) => ({ default: m.HealthPage })) }
    ],
    // its own group, between core's automation (40) and administration (50). integration-sync fills it too
    navGroups: [{ id: 'integrations', labelKey: 'integrations:nav.group', order: 45 }],
    nav: [
      { group: 'integrations', labelKey: 'integrations:nav.catalog', order: 10, icon: Plug, route: 'catalog' },
      { group: 'integrations', labelKey: 'integrations:nav.connections', order: 20, icon: Cable, route: 'connections' },
      { group: 'integrations', labelKey: 'integrations:nav.health', order: 30, icon: Activity, route: 'health' }
    ],
    i18n: integrationsMessages
  }
}
