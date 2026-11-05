import { Bot, History, PlugZap, ShieldCheck } from 'lucide-react'
import type { WasichaiModule } from '@wasichai/core'
import { integrationAiMessages } from './i18n'
import { canManageTools } from './permissions'

export const INTEGRATION_AI_MODULE_ID = 'integration-ai'

export interface IntegrationAiModuleOptions {
  // url prefix of every route of the module. default sits next to @wasichai/integrations' pages
  basePath?: string
}

// tools an agent may call on the tenant's connections, their approvals, executions and the MCP endpoint. its nav goes
// in the 'integrations' group, which @wasichai/integrations declares: register that module too (the connections the
// tools use are its own). index.ts exports the pages too; the lazy routes keep them out of an app's first bundle
export function integrationAiModule(options: IntegrationAiModuleOptions = {}): WasichaiModule {
  return {
    id: INTEGRATION_AI_MODULE_ID,
    basePath: options.basePath ?? 'integrations',
    routes: [
      { id: 'tools', path: 'ai/tools', lazy: () => import('./ToolsPage').then((m) => ({ default: m.ToolsPage })) },
      // not tools/new: 'new' is a valid tool name
      { id: 'newTool', path: 'ai/new-tool', lazy: () => import('./ToolEditorPage').then((m) => ({ default: m.ToolEditorPage })) },
      { id: 'tool', path: 'ai/tools/:toolName', lazy: () => import('./ToolPage').then((m) => ({ default: m.ToolPage })) },
      { id: 'editTool', path: 'ai/tools/:toolName/edit', lazy: () => import('./ToolEditorPage').then((m) => ({ default: m.ToolEditorPage })) },
      { id: 'approvals', path: 'ai/approvals', lazy: () => import('./ApprovalsPage').then((m) => ({ default: m.ApprovalsPage })) },
      { id: 'executions', path: 'ai/executions', lazy: () => import('./ExecutionsPage').then((m) => ({ default: m.ExecutionsPage })) },
      { id: 'execution', path: 'ai/executions/:executionId', lazy: () => import('./ExecutionPage').then((m) => ({ default: m.ExecutionPage })) },
      { id: 'mcp', path: 'ai/mcp', lazy: () => import('./McpPage').then((m) => ({ default: m.McpPage })) }
    ],
    // after integrations' (10–30), integration-sync's (40, 50) and integration-workflows' (60) entries.
    // approvals only for who may decide them; a member still reads their own executions
    nav: [
      { group: 'integrations', labelKey: 'integration-ai:nav.tools', order: 70, icon: Bot, route: 'tools' },
      { group: 'integrations', labelKey: 'integration-ai:nav.approvals', order: 75, icon: ShieldCheck, route: 'approvals', visible: canManageTools },
      { group: 'integrations', labelKey: 'integration-ai:nav.executions', order: 80, icon: History, route: 'executions' },
      { group: 'integrations', labelKey: 'integration-ai:nav.mcp', order: 85, icon: PlugZap, route: 'mcp' }
    ],
    i18n: integrationAiMessages
  }
}
