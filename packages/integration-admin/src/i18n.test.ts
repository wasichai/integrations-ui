import { describe, expect, it } from 'vitest'
import { AUTH_TYPES, CAPABILITIES, CONNECTION_STATUSES, JOB_STATUSES, MATURITIES } from './constants'
import { integrationAdminMessages } from './i18n'
import { RETENTION_SETTINGS, RETENTION_TASKS } from './retention'
import { METRICS, metricKey } from './usage'

function leaves(tree: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(tree)
    .flatMap(([key, value]) =>
      typeof value === 'object' && value !== null ? leaves(value as Record<string, unknown>, `${prefix}${key}.`) : [`${prefix}${key}`]
    )
    .sort()
}

describe('integration-admin messages', () => {
  it('has the same keys in spanish and english', () => {
    expect(leaves(integrationAdminMessages.en)).toEqual(leaves(integrationAdminMessages.es))
  })

  it('names its nav entries and every capability, maturity, auth type, status, metric and retention task', () => {
    expect(leaves(integrationAdminMessages.es)).toEqual(
      expect.arrayContaining([
        'nav.connectors',
        'nav.usage',
        'nav.system',
        'nav.retention',
        ...CAPABILITIES.map((capability) => `capability.${capability}`),
        ...MATURITIES.flatMap((maturity) => [`maturity.${maturity}`, `maturityHint.${maturity}`]),
        ...AUTH_TYPES.map((type) => `authType.${type}`),
        ...CONNECTION_STATUSES.map((status) => `connectionStatus.${status}`),
        ...JOB_STATUSES.map((status) => `jobStatus.${status}`),
        ...METRICS.map(metricKey),
        ...RETENTION_TASKS.flatMap(({ key, module }) => [`retention.task.${key}.deleted`, `retention.task.${key}.kept`, `retention.module.${module}`]),
        ...RETENTION_SETTINGS.map(({ property }) => `retention.setting.${property}`)
      ])
    )
  })
})
