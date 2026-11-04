# @wasichai/integration-sync

Backend and docs: [wasichai/integrations](https://github.com/wasichai/integrations) (`wasichai-integrations-sync`;
semantics in `docs/architecture/sync-semantics.md` and ADR-0009).

Keep records the same between two connections: a wizard to define a sync (both sides, direction, field mapping with
owner, conflict strategy and transforms, delete policy, schedule), validation against the live schemas of both sides,
activation, manual runs, the run history and the conflicts a person settles.

## Install

```
# .npmrc
@wasichai:registry=https://npm.pkg.github.com
```

```bash
yarn add @wasichai/core @wasichai/ui @wasichai/integrations @wasichai/integration-sync
```

Peers: `@wasichai/core`, `@wasichai/ui`, `react`, `react-dom`, `@tanstack/react-query`, `i18next`, `react-i18next`, `react-router`.

## Usage

Register `@wasichai/integrations` too: it declares the `integrations` nav group this module fills, and owns the
connections a sync pairs.

```tsx
import { WasichaiApp } from '@wasichai/core'
import { integrationsModule } from '@wasichai/integrations'
import { integrationSyncModule } from '@wasichai/integration-sync'

export function App() {
  return <WasichaiApp config={{ apiBaseUrl: '/api' }} modules={[integrationsModule(), integrationSyncModule()]} />
}
```

## What it adds

| Slot | Value |
|---|---|
| routes | `integration-sync:definitions` → `/integrations/sync-definitions`, `newDefinition` → `…/new`, `definition` → `…/:definitionId`, `editDefinition` → `…/:definitionId/edit`, `conflicts` → `/integrations/conflicts`; all lazy |
| nav | group `integrations` (declared by `@wasichai/integrations`): Sincronizaciones (40), Conflictos (50) |
| i18n | namespace `integration-sync` (es, en) |

It reads `/integrations/connections`, `/connections/{id}/resources` and `/connections/{id}/resources/{resource}/schema`
under the same query keys as `@wasichai/integrations`, without importing it. Creating, editing, validating, activating,
running and resolving are shown only to `admin` or `MANAGE_ORGANIZATION`.

## Options

| Option | Default | Meaning |
|---|---|---|
| `basePath` | `'integrations'` | url prefix of every route |

## Backend

Needs `wasichai-integrations-sync`: `/api/integrations/sync-definitions` (GET/POST, GET/PUT with If-Match/DELETE by id,
`/validate`, `/activate`, `/deactivate`, `/run`, `/runs`) and `/api/integrations/conflicts` (GET, `/{id}/resolve`).
