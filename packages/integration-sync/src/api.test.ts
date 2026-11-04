import { describe, expect, it } from 'vitest'
import { connectionOptionsQuery, resourceOptionsQuery, schemaOptionsQuery } from './api'

// these reads belong to @wasichai/integrations. the keys must stay its own (connectionsQuery, resourcesQuery,
// schemaQuery), or the two caches split
describe('reads borrowed from the integrations module', () => {
  it('reads connections, resources and schemas under the integrations keys', () => {
    expect(connectionOptionsQuery().queryKey).toEqual(['integrations', 'connections'])
    expect(resourceOptionsQuery('c1').queryKey).toEqual(['integrations', 'connections', 'c1', 'resources'])
    expect(schemaOptionsQuery('c1', 'contacts').queryKey).toEqual(['integrations', 'connections', 'c1', 'resources', 'contacts', 'schema'])
  })

  it('asks discovery only with something picked, and never retries a provider failure', () => {
    expect(resourceOptionsQuery('').enabled).toBe(false)
    expect(resourceOptionsQuery('c1').retry).toBe(false)
    expect(schemaOptionsQuery('c1', null).enabled).toBe(false)
    expect(schemaOptionsQuery('c1', 'contacts').retry).toBe(false)
  })
})
