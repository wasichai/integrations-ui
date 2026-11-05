import type { UsageRow } from './types'

// the metrics the backend counts today (api.md › Usage). another one a module adds still shows: it comes from the rows
export const METRICS = ['provider.calls', 'sync.records', 'workflow.steps', 'ai.tool_calls'] as const

// i18n keys split on dots: metric.provider_calls names provider.calls
export function metricKey(name: string): string {
  return `metric.${name.replace(/\./g, '_')}`
}

// GET /usage's own defaults and limit: the 30 days ending today, at most 366 days apart (UsageService)
export const DEFAULT_DAYS = 30
export const MAX_DAYS = 366

const DAY = /^\d{4}-\d{2}-\d{2}$/
const MS_PER_DAY = 86_400_000

// usage days are UTC: today is today in UTC, not in the browser's zone
export function todayUtc(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10)
}

export function defaultRange(now = new Date()): { from: string; to: string } {
  const to = todayUtc(now)
  return { from: addDays(to, -(DEFAULT_DAYS - 1)), to }
}

function isDay(value: string): boolean {
  return DAY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && addDays(value, 0) === value
}

// what the server would refuse with a 400, said before asking it
export type RangeProblem = 'invalid' | 'order' | 'tooLong'

export function rangeProblem(from: string, to: string): RangeProblem | null {
  if (!isDay(from) || !isDay(to)) return 'invalid'
  if (from > to) return 'order'
  if ((Date.parse(to) - Date.parse(from)) / MS_PER_DAY >= MAX_DAYS) return 'tooLong'
  return null
}

export interface UsageDay {
  day: string
  counts: Record<string, number>
  total: number
}

export interface UsageTally {
  // the known metrics first, then any other the rows name
  metrics: string[]
  totals: Record<string, number>
  // every day of the range, oldest first: a day without rows is a zero, not a gap
  days: UsageDay[]
  max: number
}

export function tally(rows: UsageRow[], from: string, to: string, metric: string | null): UsageTally {
  const seen = new Set(rows.map((row) => row.metric))
  const metrics = metric ? [metric] : [...METRICS, ...[...seen].filter((name) => !(METRICS as readonly string[]).includes(name)).sort()]
  const byDay = new Map<string, Record<string, number>>()
  const totals: Record<string, number> = Object.fromEntries(metrics.map((name) => [name, 0]))
  for (const row of rows) {
    const counts = byDay.get(row.day) ?? {}
    counts[row.metric] = (counts[row.metric] ?? 0) + row.count
    byDay.set(row.day, counts)
    totals[row.metric] = (totals[row.metric] ?? 0) + row.count
  }
  const days: UsageDay[] = []
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const counts = byDay.get(day) ?? {}
    days.push({ day, counts, total: Object.values(counts).reduce((sum, count) => sum + count, 0) })
  }
  return { metrics, totals, days, max: Math.max(0, ...days.map((day) => day.total)) }
}
