# @wasichai/integration-ai

Backend and docs: [wasichai/integrations](https://github.com/wasichai/integrations) (`wasichai-integrations-ai`;
contract in `docs/architecture/api.md` › AI tools and MCP endpoint, guide in `docs/guides/ai-tools.md`, ADR-0026 and
ADR-0027).

AI tools over the tenant's connections: a list filtered by connection (enabled, approval, roles), an editor that exposes
a connector action (with its input JSON schema) or one record operation on a resource (with its derived schema), the
roles that may call it, whether a person approves each call, its rate limit and whether it is enabled; a tool page that
tries the tool as the person signed in (a form for a flat schema, JSON otherwise; a `200` that ran or a `202` that
waits); the pending approvals, approved (it runs once) or rejected with a reason; the execution history paged by cursor
and filtered by status and tool, each with its input, output summary, error kind and decision; and the MCP endpoint an
agent connects to, with an example client configuration.

## Install

```
# .npmrc
@wasichai:registry=https://npm.pkg.github.com
```

```bash
yarn add @wasichai/core @wasichai/ui @wasichai/integrations @wasichai/integration-ai
```

Peers: `@wasichai/core`, `@wasichai/ui`, `react`, `react-dom`, `@tanstack/react-query`, `i18next`, `react-i18next`, `react-router`.
Dependency: `lucide-react`.

## Usage

Register `@wasichai/integrations` too: it declares the `integrations` nav group this module fills, and owns the
connections the tools use.

```tsx
import { WasichaiApp } from '@wasichai/core'
import { integrationsModule } from '@wasichai/integrations'
import { integrationAiModule } from '@wasichai/integration-ai'

export function App() {
  return <WasichaiApp config={{ apiBaseUrl: '/api' }} modules={[integrationsModule(), integrationAiModule()]} />
}
```

## What it adds

| Slot | Value |
|---|---|
| routes | `integration-ai:tools` → `/integrations/ai/tools`, `newTool` → `…/ai/new-tool`, `tool` → `…/ai/tools/:toolName`, `editTool` → `…/ai/tools/:toolName/edit`, `approvals` → `…/ai/approvals`, `executions` → `…/ai/executions` (`?status=&tool=`), `execution` → `…/ai/executions/:executionId`, `mcp` → `…/ai/mcp`; all lazy |
| nav | group `integrations` (declared by `@wasichai/integrations`): Herramientas de IA (70), Aprobaciones de IA (75, managers only), Ejecuciones de IA (80), Servidor MCP (85) |
| i18n | namespace `integration-ai` (es, en) |

It reads `/integrations/connections`, `/integrations/connectors/{id}` and `/integrations/connections/{id}/resources`
under the same query keys as `@wasichai/integrations`, without importing it, and the tenant's roles with
`@wasichai/core`'s `useRoles`. When connections cannot be read the list shows their ids; when roles cannot be read
they are typed by hand; when resources cannot be discovered the resource is typed.

Exposing, editing and deleting tools and deciding approvals are shown only to `admin` or `MANAGE_ORGANIZATION`. A member
sees the enabled tools a role of theirs may call, tries them, and reads their own executions.

## The editor

- The whole tool is sent every time (`POST`, or `PUT` with `If-Match: "<version>"`; `412`: changed meanwhile, reload).
  A rename is a `PUT` to the old name.
- Operations follow the connector's capabilities (`READ`: read, list; `WRITE`: create, update, delete; `UPSERT`:
  upsert, with its external id field). Approval follows the backend's default (on for actions and writes, off for read
  and list) until it is set by hand.
- The action schema is checked to be a JSON object before sending; every `400` violation is shown under its field
  (`inputSchema.properties.x.pattern` under the schema, `allowedRoles[0]` under the roles), the rest at the top.

## Options

| Option | Default | Meaning |
|---|---|---|
| `basePath` | `'integrations'` | url prefix of every route |

## Backend

Needs `wasichai-integrations-ai`: `/api/integrations/ai/tools` (GET/POST, GET/PUT with If-Match/DELETE by name,
`/execute`), `/api/integrations/ai/executions` (GET with `status`, `tool`, `cursor`, `limit`; GET by id, `/approve`,
`/reject`) and, for agents, `POST /api/integrations/mcp` (MCP 2025-06-18). The MCP page shows that url resolved
against the app's `apiBaseUrl`.
