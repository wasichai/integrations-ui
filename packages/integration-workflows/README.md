# @wasichai/integration-workflows

Backend and docs: [wasichai/integrations](https://github.com/wasichai/integrations) (`wasichai-integrations-workflows`;
contract in `docs/architecture/api.md` › Workflows and Executions, guide in `docs/guides/workflows.md`, ADR-0022 and
ADR-0025).

Workflows across connections: a list (draft or published, paused, unpublished changes), a designer that draws the
draft graph (trigger, action, condition, branch, parallel and join, delay, approval, end, `onError` edges) with a form
per node, saves it, validates it and publishes it, the published versions, manual runs with a JSON payload,
pause/resume, the workflow's webhook url (issued or rotated, shown once), and the run history: runs paged by cursor and
filtered by status, each with its step timeline (status, attempts, input, output, errors, waits), cancel, and approve
or reject for a waiting approval.

## Install

```
# .npmrc
@wasichai:registry=https://npm.pkg.github.com
```

```bash
yarn add @wasichai/core @wasichai/ui @wasichai/integrations @wasichai/integration-workflows
```

Peers: `@wasichai/core`, `@wasichai/ui`, `react`, `react-dom`, `@tanstack/react-query`, `i18next`, `react-i18next`, `react-router`.
Dependencies: `lucide-react` and `@xyflow/react` (the same version `@wasichai/workflow` uses), loaded only by the
designer's lazy route.

## Usage

Register `@wasichai/integrations` too: it declares the `integrations` nav group this module fills, and owns the
connections the steps use.

```tsx
import { WasichaiApp } from '@wasichai/core'
import { integrationsModule } from '@wasichai/integrations'
import { integrationWorkflowsModule } from '@wasichai/integration-workflows'

export function App() {
  return <WasichaiApp config={{ apiBaseUrl: '/api' }} modules={[integrationsModule(), integrationWorkflowsModule()]} />
}
```

## What it adds

| Slot | Value |
|---|---|
| routes | `integration-workflows:workflows` → `/integrations/workflows`, `workflow` → `…/:workflowId`, `designer` → `…/:workflowId/design`, `version` → `…/:workflowId/versions/:number`, `execution` → `…/:workflowId/executions/:executionId`; all lazy |
| nav | group `integrations` (declared by `@wasichai/integrations`): Flujos de trabajo (60) |
| i18n | namespace `integration-workflows` (es, en) |

It reads `/integrations/connections` under the same query key as `@wasichai/integrations`, without importing it; when
that list fails the designer still shows (and keeps) the connection ids a draft holds. Creating, designing, deleting,
running, pausing, issuing the webhook url, cancelling and deciding approvals are shown only to `admin` or
`MANAGE_ORGANIZATION`.

The main entry never reaches `@xyflow/react`: the designer is not exported and comes only through its lazy route
(`boundaries.test.ts` checks it).

## The designer

- Nodes come from the draft graph, laid out by distance from the trigger; dragging a node moves it for the session only
  (the graph has no layout keys, so a moved node never shows as an unpublished change).
- Each node has one outgoing handle per edge it may have (`next`, `then`, `else`, `rejected`, `join`, `branches`,
  `onError` at the bottom). Dragging from a handle to a step sets that edge; the panel sets and clears every edge too,
  and a "Go to node" select reaches every node from the keyboard.
- Save is `PUT` with `If-Match: "<version>"` (`412`: saved meanwhile, reload). Validate and publish save a changed
  draft first. A violation (`graph.steps[2].input.email`) is placed on its step by id and shown under the field it
  names; one the panel draws no field for is listed at the top of the panel. Publish shows `422` the same way, `409`
  as nothing new to publish and `412` as stale.
- Conditions: a leaf (`equals`, `notEquals`, `exists`, `in`, `gt`, `lt`) as fields; `and`, `or` and `not` as the JSON of
  their members. Operands are a reference or a JSON literal (plain text is a string).
- Renaming a step moves the edges that name it, not the `steps.<id>…` references: validate reports those.

## Options

| Option | Default | Meaning |
|---|---|---|
| `basePath` | `'integrations'` | url prefix of every route |

## Backend

Needs `wasichai-integrations-workflows`: `/api/integrations/workflows` (GET/POST, GET/PUT with If-Match/DELETE by id,
`/validate`, `/publish`, `/versions`, `/versions/{n}`, `/run`, `/pause`, `/resume`, `/webhook`, `/executions`) and
`/api/integrations/workflows/executions/{id}` (GET, `/cancel`, `/steps/{stepId}/approve`, `/steps/{stepId}/reject`).
