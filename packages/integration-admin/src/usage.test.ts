import { describe, expect, it } from 'vitest'
import { addDays, defaultRange, metricKey, rangeProblem, tally, todayUtc } from './usage'

describe('usage ranges', () => {
  it('counts days in UTC, whatever the browser zone', () => {
    expect(todayUtc(new Date('2026-11-05T23:30:00-05:00'))).toBe('2026-11-06')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('defaults to the 30 days ending today, as the server does', () => {
    expect(defaultRange(new Date('2026-11-05T12:00:00Z'))).toEqual({ from: '2026-10-07', to: '2026-11-05' })
  })

  it('says what the server would refuse', () => {
    expect(rangeProblem('2026-10-07', '2026-11-05')).toBeNull()
    expect(rangeProblem('', '2026-11-05')).toBe('invalid')
    expect(rangeProblem('2026-02-30', '2026-03-05')).toBe('invalid')
    expect(rangeProblem('2026-11-06', '2026-11-05')).toBe('order')
    // 366 days apart is one too many: at most 366 days inclusive
    expect(rangeProblem('2025-01-01', '2026-01-01')).toBeNull()
    expect(rangeProblem('2024-01-01', '2025-01-01')).toBe('tooLong')
  })

  it('names a metric with a key i18next does not split', () => {
    expect(metricKey('ai.tool_calls')).toBe('metric.ai_tool_calls')
  })
})

describe('tally', () => {
  const rows = [
    { day: '2026-11-03', metric: 'provider.calls', count: 10 },
    { day: '2026-11-03', metric: 'sync.records', count: 4 },
    { day: '2026-11-05', metric: 'provider.calls', count: 2 },
    { day: '2026-11-05', metric: 'custom.metric', count: 1 }
  ]

  it('fills every day of the range, sums per metric and keeps unknown metrics after the known ones', () => {
    const result = tally(rows, '2026-11-03', '2026-11-05', null)
    expect(result.metrics).toEqual(['provider.calls', 'sync.records', 'workflow.steps', 'ai.tool_calls', 'custom.metric'])
    expect(result.totals).toEqual({ 'provider.calls': 12, 'sync.records': 4, 'workflow.steps': 0, 'ai.tool_calls': 0, 'custom.metric': 1 })
    expect(result.days.map((day) => [day.day, day.total])).toEqual([
      ['2026-11-03', 14],
      ['2026-11-04', 0],
      ['2026-11-05', 3]
    ])
    expect(result.max).toBe(14)
  })

  it('shows only the filtered metric', () => {
    expect(tally([rows[0]], '2026-11-03', '2026-11-03', 'provider.calls').metrics).toEqual(['provider.calls'])
  })
})
