import { useQuery } from '@tanstack/react-query'
import { ChartColumn } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { EmptyState, PageHeader, QueryState } from '@wasichai/core'
import { Button, Card, CardBody, CardHeader, CardTitle, Input, Label, Table, Td, Th } from '@wasichai/ui'
import { usageQuery } from './api'
import { METRICS, defaultRange, metricKey, rangeProblem, tally, type UsageTally } from './usage'

// the backend's own metric name rule: anything else is ignored, not sent
const METRIC_NAME = /^[a-z][a-z0-9._]{0,63}$/

// the tenant's daily counters. range and metric live in the url (?from=&to=&metric=); no range is the last 30 days
export function UsagePage() {
  const { t } = useTranslation('integration-admin')
  const [params, setParams] = useSearchParams()
  const defaults = defaultRange()
  const from = params.get('from') ?? defaults.from
  const to = params.get('to') ?? defaults.to
  const metricParam = params.get('metric')
  const metric = metricParam && METRIC_NAME.test(metricParam) ? metricParam : null
  const problem = rangeProblem(from, to)
  const query = useQuery(usageQuery(from, to, metric, problem === null))

  const set = (key: 'from' | 'to' | 'metric', value: string | null) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value !== null) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true }
    )

  return (
    <>
      <PageHeader title={t('usage.title')} subtitle={t('usage.subtitle')} />
      <div className="space-y-5 p-4 md:p-8">
        <Card>
          <CardBody className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="usage-from">{t('usage.from')}</Label>
                <Input
                  id="usage-from"
                  type="date"
                  value={from}
                  max={to}
                  onChange={(event) => set('from', event.target.value)}
                  aria-invalid={problem ? true : undefined}
                  aria-describedby={problem ? 'usage-range-error' : undefined}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="usage-to">{t('usage.to')}</Label>
                <Input
                  id="usage-to"
                  type="date"
                  value={to}
                  min={from}
                  onChange={(event) => set('to', event.target.value)}
                  aria-invalid={problem ? true : undefined}
                  aria-describedby={problem ? 'usage-range-error' : undefined}
                />
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setParams(
                    (current) => {
                      const next = new URLSearchParams(current)
                      next.delete('from')
                      next.delete('to')
                      return next
                    },
                    { replace: true }
                  )
                }
              >
                {t('usage.last30')}
              </Button>
            </div>
            {problem ? (
              <p id="usage-range-error" className="text-xs text-danger">
                {t(`usage.problem.${problem}`)}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('usage.metric')}>
              {[null, ...METRICS, ...(metric && !(METRICS as readonly string[]).includes(metric) ? [metric] : [])].map((value) => (
                <Button
                  key={value ?? 'all'}
                  variant={metric === value ? 'primary' : 'secondary'}
                  size="sm"
                  aria-pressed={metric === value}
                  onClick={() => set('metric', value)}
                >
                  {value ? t(metricKey(value), { defaultValue: value }) : t('usage.allMetrics')}
                </Button>
              ))}
            </div>
            <p className="text-xs text-ink-muted">{t('usage.utc')}</p>
          </CardBody>
        </Card>
        {problem ? null : (
          <QueryState query={query}>
            {(rows) =>
              rows.length === 0 ? (
                <Card>
                  <EmptyState icon={ChartColumn} title={t('usage.empty')} description={t('usage.emptyHint')} />
                </Card>
              ) : (
                <Counts tally={tally(rows, from, to, metric)} />
              )
            }
          </QueryState>
        )}
      </div>
    </>
  )
}

function Counts({ tally }: { tally: UsageTally }) {
  const { t, i18n } = useTranslation('integration-admin')
  const number = (value: number) => value.toLocaleString(i18n.language)

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('usage.totals')}</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {tally.metrics.map((name) => (
              <div key={name} className="rounded-md border border-border px-4 py-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t(metricKey(name), { defaultValue: name })}</dt>
                <dd className="text-2xl font-semibold text-ink">{number(tally.totals[name] ?? 0)}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('usage.perDay')}</CardTitle>
        </CardHeader>
        <Table>
          <thead>
            <tr>
              <Th>{t('usage.day')}</Th>
              {tally.metrics.map((name) => (
                <Th key={name} className="text-right">
                  {t(metricKey(name), { defaultValue: name })}
                </Th>
              ))}
              {tally.metrics.length > 1 ? <Th className="text-right">{t('usage.total')}</Th> : null}
              <Th className="w-1/4">
                <span className="sr-only">{t('usage.bar')}</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {/* newest first: today is what an operator looks for */}
            {[...tally.days].reverse().map((day) => (
              <tr key={day.day}>
                <Td className="font-mono text-sm">
                  <time dateTime={day.day}>{day.day}</time>
                </Td>
                {tally.metrics.map((name) => (
                  <Td key={name} className="text-right tabular-nums">
                    {number(day.counts[name] ?? 0)}
                  </Td>
                ))}
                {tally.metrics.length > 1 ? <Td className="text-right font-medium tabular-nums">{number(day.total)}</Td> : null}
                <Td>
                  {/* the number is in the row: the bar only draws it, so screen readers skip it */}
                  <div aria-hidden="true" className="h-2 rounded bg-surface-muted">
                    <div className="h-2 rounded bg-brand" style={{ width: `${tally.max ? (day.total / tally.max) * 100 : 0}%` }} />
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  )
}
