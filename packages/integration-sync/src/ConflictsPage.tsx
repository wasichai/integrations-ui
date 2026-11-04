import { useQuery } from '@tanstack/react-query'
import { CircleCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { EmptyState, PageHeader, QueryState, formError, useWasichaiLinks, type FieldViolation } from '@wasichai/core'
import { Alert, Button, Card, Dialog, DialogContent, DialogDescription, DialogTitle, Input, Table, Td, Th, cn } from '@wasichai/ui'
import { conflictsQuery, definitionsQuery, useResolveConflict } from './api'
import { ConflictStatusBadge, Time } from './badges'
import { showValue } from './draft'
import { useCanManageSync } from './permissions'
import type { Conflict, ConflictField, ConflictStatus, ResolveRequest } from './types'

const STATUSES: ConflictStatus[] = ['OPEN', 'RESOLVED']

export function ConflictsPage() {
  const { t } = useTranslation(['integration-sync', 'common'])
  const links = useWasichaiLinks()
  const [params] = useSearchParams()
  const definitionId = params.get('definitionId')
  const [status, setStatus] = useState<ConflictStatus>('OPEN')
  const query = useQuery(conflictsQuery(status, definitionId))
  const { data: definitions = [] } = useQuery(definitionsQuery())
  const canManage = useCanManageSync()
  const [resolving, setResolving] = useState<Conflict | null>(null)
  const [resolved, setResolved] = useState(false)
  const nameOf = (id: string) => definitions.find((definition) => definition.id === id)?.name ?? id

  return (
    <>
      <PageHeader title={t('conflicts.title')} subtitle={definitionId ? t('conflicts.of', { name: nameOf(definitionId) }) : t('conflicts.subtitle')}>
        <div role="group" aria-label={t('conflicts.filter')} className="flex gap-2">
          {STATUSES.map((value) => (
            <Button key={value} variant={status === value ? 'primary' : 'secondary'} size="sm" aria-pressed={status === value} onClick={() => setStatus(value)}>
              {t(`conflictStatus.${value}`)}
            </Button>
          ))}
        </div>
      </PageHeader>
      <div className="space-y-4 p-4 md:p-8">
        {resolved ? (
          <Alert tone="success" onDismiss={() => setResolved(false)}>
            {t('conflicts.resolved')}
          </Alert>
        ) : null}
        <QueryState query={query}>
          {(conflicts) =>
            conflicts.length === 0 ? (
              <EmptyState icon={CircleCheck} title={t(status === 'OPEN' ? 'conflicts.empty' : 'conflicts.emptyResolved')} headingLevel={2} />
            ) : (
              <Card>
                <Table>
                  <thead>
                    <tr>
                      <Th>{t('conflicts.definition')}</Th>
                      <Th>{t('conflicts.fields')}</Th>
                      <Th>{t('conflicts.detected')}</Th>
                      <Th>{t('conflicts.status')}</Th>
                      <Th>
                        <span className="sr-only">{t('common.actions')}</span>
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {conflicts.map((conflict) => (
                      <tr key={conflict.id}>
                        <Td>
                          <Link to={links.to('integration-sync:definition', { definitionId: conflict.definitionId })} className="font-medium hover:underline">
                            {nameOf(conflict.definitionId)}
                          </Link>
                        </Td>
                        <Td>
                          {conflict.kind === 'DELETED' ? (
                            <span className="text-ink-muted">{t('conflicts.deleted')}</span>
                          ) : (
                            <ul className="space-y-0.5 text-xs">
                              {conflict.fields.map((field) => (
                                <li key={field.key}>
                                  <span className="font-medium text-ink">{field.aField}</span>
                                  <span className="text-ink-muted">
                                    {' '}
                                    A: {showValue(field.a)} · B: {showValue(field.b)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </Td>
                        <Td>
                          <Time value={conflict.detectedAt} />
                        </Td>
                        <Td>
                          <ConflictStatusBadge status={conflict.status} />
                        </Td>
                        <Td>
                          {canManage && conflict.status === 'OPEN' ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setResolved(false)
                                setResolving(conflict)
                              }}
                              aria-label={t('conflicts.resolveNamed', { name: nameOf(conflict.definitionId) })}
                            >
                              {t('conflicts.resolve')}
                            </Button>
                          ) : null}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card>
            )
          }
        </QueryState>
      </div>
      {resolving ? (
        <ResolveDialog
          conflict={resolving}
          onClose={() => setResolving(null)}
          onResolved={() => {
            setResolving(null)
            setResolved(true)
          }}
        />
      ) : null}
    </>
  )
}

type Pick = 'A' | 'B' | 'CUSTOM'

// per field: A's value, B's value or a typed one. all A or all B is that choice; a mix is CUSTOM with
// values keyed by A's field names. a kept value goes back encoded ({t, v}), which the server reads as is
export function resolutionOf(fields: ConflictField[], picks: Record<string, Pick>, typed: Record<string, string>): ResolveRequest {
  const choices = fields.map((field) => picks[field.key] ?? 'A')
  if (choices.every((choice) => choice === 'A')) return { choice: 'A' }
  if (choices.every((choice) => choice === 'B')) return { choice: 'B' }
  return {
    choice: 'CUSTOM',
    values: Object.fromEntries(
      fields.map((field) => {
        const choice = picks[field.key] ?? 'A'
        return [field.aField, choice === 'A' ? field.a : choice === 'B' ? field.b : (typed[field.key] ?? '')]
      })
    )
  }
}

function ResolveDialog({ conflict, onClose, onResolved }: { conflict: Conflict; onClose: () => void; onResolved: () => void }) {
  const { t } = useTranslation(['integration-sync', 'common'])
  const resolve = useResolveConflict()
  const [picks, setPicks] = useState<Record<string, Pick>>({})
  const [typed, setTyped] = useState<Record<string, string>>({})
  const [error, setError] = useState<{ message: string; violations: FieldViolation[] } | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      // a deleted record has nothing to choose: resolving forgets the pair
      await resolve.mutateAsync({ conflictId: conflict.id, request: conflict.kind === 'DELETED' ? {} : resolutionOf(conflict.fields, picks, typed) })
      onResolved()
    } catch (cause) {
      setError(formError(cause))
    }
  }

  const violation = (field: ConflictField) => error?.violations.find((candidate) => candidate.field === `values.${field.aField}`)?.message

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogTitle className="text-lg font-semibold">{t('conflicts.resolveTitle')}</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-ink-muted">
          {conflict.kind === 'DELETED' ? t('conflicts.deletedHint') : t('conflicts.resolveHint')}
        </DialogDescription>
        <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
          {conflict.kind === 'FIELDS'
            ? conflict.fields.map((field) => {
                const pick = picks[field.key] ?? 'A'
                const name = `pick-${field.key}`
                const problem = violation(field)
                return (
                  <fieldset key={field.key} className="space-y-2 rounded-md border border-border p-3">
                    <legend className="px-1 text-sm font-medium text-ink">
                      {field.aField} ↔ {field.bField}
                    </legend>
                    {field.base ? (
                      <p className="text-xs text-ink-muted">{t('conflicts.base', { a: showValue(field.base.a), b: showValue(field.base.b) })}</p>
                    ) : null}
                    {(['A', 'B', 'CUSTOM'] as Pick[]).map((option) => (
                      <label key={option} className={cn('flex items-center gap-2 text-sm', pick === option ? 'text-ink' : 'text-ink-muted')}>
                        <input
                          type="radio"
                          name={name}
                          className="h-4 w-4 accent-brand"
                          checked={pick === option}
                          onChange={() => setPicks((current) => ({ ...current, [field.key]: option }))}
                        />
                        {option === 'A'
                          ? t('conflicts.keepA', { value: showValue(field.a) })
                          : option === 'B'
                            ? t('conflicts.keepB', { value: showValue(field.b) })
                            : t('conflicts.custom')}
                      </label>
                    ))}
                    {pick === 'CUSTOM' ? (
                      <div className="space-y-1">
                        <Input
                          aria-label={t('conflicts.customValue', { field: field.aField })}
                          value={typed[field.key] ?? ''}
                          onChange={(event) => setTyped((current) => ({ ...current, [field.key]: event.target.value }))}
                          aria-invalid={problem ? true : undefined}
                        />
                        {problem ? <p className="text-xs text-danger">{problem}</p> : null}
                      </div>
                    ) : null}
                  </fieldset>
                )
              })
            : null}
          {error ? <Alert tone="danger">{error.message}</Alert> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={resolve.isPending}>
              {conflict.kind === 'DELETED' ? t('conflicts.unlink') : t('conflicts.resolve')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
