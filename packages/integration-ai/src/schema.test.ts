import { describe, expect, it } from 'vitest'
import { defaultApproval, formInput, operationsFor, parseSchema, placeViolations, simpleFields } from './schema'
import { actionTool, crm, slack } from './test/fixtures'

describe('schema helpers', () => {
  it('defaults approval like the backend: on for actions and writes, off for read and list', () => {
    expect(defaultApproval('ACTION', null)).toBe(true)
    expect(defaultApproval('RESOURCE', 'READ')).toBe(false)
    expect(defaultApproval('RESOURCE', 'LIST')).toBe(false)
    expect(['CREATE', 'UPDATE', 'UPSERT', 'DELETE'].every((op) => defaultApproval('RESOURCE', op as 'CREATE'))).toBe(true)
  })

  it('offers the operations the connector declares', () => {
    expect(operationsFor(crm)).toEqual(['READ', 'LIST', 'CREATE', 'UPDATE', 'DELETE'])
    expect(operationsFor(slack)).toEqual([])
    expect(operationsFor(undefined)).toHaveLength(6)
  })

  it('accepts only a JSON object as a schema', () => {
    expect(parseSchema('{"type":"object"}')).toEqual({ schema: { type: 'object' } })
    expect(parseSchema('{')).toEqual({ error: 'json' })
    expect(parseSchema('[]')).toEqual({ error: 'object' })
  })

  it('draws a form for a flat schema of simple types, JSON for anything else', () => {
    const fields = simpleFields(actionTool().inputSchema)
    expect(fields?.map((field) => [field.name, field.type, field.required, field.options])).toEqual([
      ['channel', 'string', true, ['support', 'support-escalations']],
      ['text', 'string', true, null],
      ['urgent', 'boolean', false, null],
      ['priority', 'integer', false, null]
    ])
    expect(simpleFields({ type: 'object', properties: { fields: { type: 'object' } } })).toBeNull()
    expect(formInput(fields!, { channel: 'support', text: 'hi', priority: '2', urgent: true })).toEqual({
      channel: 'support',
      text: 'hi',
      priority: 2,
      urgent: true
    })
    expect(formInput(fields!, { text: '  ' })).toEqual({})
  })

  it('places violations under the field they name', () => {
    const placed = placeViolations(
      [
        { field: 'allowedRoles[1]', message: "no role 'X'" },
        { field: 'inputSchema.properties.x.pattern', message: 'not supported' },
        { field: 'name', message: 'taken' },
        { field: 'other', message: 'odd' }
      ],
      ['name', 'allowedRoles', 'inputSchema']
    )
    expect(placed.byField).toEqual({
      allowedRoles: "allowedRoles[1]: no role 'X'",
      inputSchema: 'inputSchema.properties.x.pattern: not supported',
      name: 'taken'
    })
    expect(placed.rest).toEqual([{ field: 'other', message: 'odd' }])
  })
})
