# @wasichai/integrations

Backend and docs: [wasichai/integrations](https://github.com/wasichai/integrations) (API contract in
`docs/architecture/api.md`).

Connect a wasichai app to external systems: the connector catalog, the tenant's provider apps (OAuth client id and
secret), connections (OAuth or API key / basic), each connection's resources and schemas, webhooks and events, and an
operator's health page with dead jobs.

## Install

```
# .npmrc
@wasichai:registry=https://npm.pkg.github.com
```

```bash
yarn add @wasichai/core @wasichai/ui @wasichai/integrations
```

Peers: `@wasichai/core`, `@wasichai/ui`, `react`, `react-dom`, `@tanstack/react-query`, `i18next`, `react-i18next`, `react-router`.

## Usage

```tsx
import { WasichaiApp } from '@wasichai/core'
import { integrationsModule } from '@wasichai/integrations'

export function App() {
  return <WasichaiApp config={{ apiBaseUrl: '/api', appName: 'My App' }} modules={[integrationsModule()]} />
}
```

## What it adds

| Slot | Value |
|---|---|
| routes | `integrations:catalog` → `/integrations/connectors`, `integrations:connector` → `/integrations/connectors/:connectorId`, `integrations:connections` → `/integrations/connections`, `integrations:connection` → `/integrations/connections/:connectionId`, `integrations:health` → `/integrations/health`; all lazy |
| nav | its own group `integrations` (order 45): Conectores (10), Conexiones (20), Estado (30) |
| i18n | namespace `integrations` (es, en) |

Connect, delete, provider apps, webhook management, the verification token, event replay and dead jobs are shown only
to a caller with `admin` or the `MANAGE_ORGANIZATION` capability; the server refuses everyone else anyway.

## OAuth return

The backend sends the browser back to `wasichai.integrations.oauth.return-url` with `?status=connected&connectionId=…`
or `?status=error&error=<code>`. Point it at the connections page (`https://app.example.com/integrations/connections`):
it shows the outcome and explains each code (`invalid_state`, `access_denied`, `provider_error`, `token_refused`,
`provider_unavailable`, `provider_not_configured`, `missing_code`, `unknown_connector`).

## Options

| Option | Default | Meaning |
|---|---|---|
| `basePath` | `'integrations'` | url prefix of every route |

## Backend

Needs `wasichai-integrations`: `/api/integrations/connectors`, `/provider-configs`, `/connections` (+ `/test`,
`/oauth/start`, `/resources`, `/webhook-endpoints`), `/webhook-endpoints/{id}/verification-token`, `/events`,
`/jobs` and `/health`. The query factories (`connectionsQuery`, `resourcesQuery`, `schemaQuery`…) are exported; another
module reads the same data by copying their path and key, never by importing this package.
