import { describe, expect, it } from 'vitest'
import { blankDraft, draftOf, placeViolations, requestOf, showValue } from './draft'
import type { SyncDefinition } from './types'

const stored: SyncDefinition = {
  id: 'd1',
  name: 'Contactos',
  a: { connectionId: 'c1', resource: 'contacts' },
  b: { connectionId: 'c2', resource: 'people' },
  direction: 'BIDIRECTIONAL',
  status: 'DRAFT',
  deletePolicy: 'FLAG',
  scheduleSeconds: 300,
  reconcileSeconds: null,
  matchOn: { aField: 'email', bField: 'mail' },
  mappings: [
    { aField: 'email', bField: 'mail', transform: null, owner: 'BOTH', conflictStrategy: 'MANUAL' },
    { aField: 'stage', bField: 'status', transform: { type: 'enumMap', map: { lead: 'new', customer: 'won' } }, owner: 'A', conflictStrategy: 'A_WINS' },
    { aField: 'amount', bField: 'total', transform: { type: 'number', scale: 2 }, owner: 'A', conflictStrategy: 'MANUAL' }
  ],
  version: 2,
  createdAt: '2026-11-04T10:00:00Z',
  updatedAt: '2026-11-04T10:00:00Z'
}

describe('definition draft', () => {
  it('round-trips a stored definition into the same request', () => {
    const { id: _id, status: _status, version: _version, createdAt: _created, updatedAt: _updated, ...request } = stored
    expect(requestOf(draftOf(stored))).toEqual(request)
  })

  it('sends nothing for what was left empty', () => {
    const request = requestOf(blankDraft())
    expect(request.a).toEqual({ connectionId: null, resource: null })
    expect(request.matchOn).toBeNull()
    expect(request.scheduleSeconds).toBeNull()
    expect(request.mappings).toEqual([{ aField: null, bField: null, transform: null, owner: 'A', conflictStrategy: 'MANUAL' }])
  })

  it('puts each violation next to its field, a row cell, or the banner', () => {
    const placed = placeViolations([
      { field: 'name', message: '1 to 200 characters' },
      { field: 'a.resource', message: 'required' },
      { field: 'mappings[1].bField', message: "no field 'x' in People" },
      { field: 'mappings[1].transform.map', message: "'z' is not an option of status" },
      { field: 'matchOn.aField', message: "no field 'e' in A" },
      { field: 'mappings', message: "field 'email' of A is mapped twice" },
      { field: 'credentials', message: 'whatever' }
    ])
    expect(placed.form.name).toBe('1 to 200 characters')
    expect(placed.form['a.resource']).toBe('required')
    expect(placed.form.matchOn).toBe("no field 'e' in A")
    expect(placed.rows[1]).toEqual({ bField: "no field 'x' in People", transform: "'z' is not an option of status" })
    expect(placed.form.mappings).toBe("field 'email' of A is mapped twice")
    expect(placed.rest.map((violation) => violation.field)).toEqual(['credentials'])
  })

  it('shows stored values as a person reads them', () => {
    expect(showValue({ t: 'null' })).toBe('—')
    expect(showValue({ t: 'text', v: 'Ana' })).toBe('Ana')
    expect(showValue({ t: 'multi', v: ['a', 'b'] })).toBe('a, b')
    expect(showValue({ t: 'ref', r: 'accounts', v: '7' })).toBe('accounts#7')
  })
})
