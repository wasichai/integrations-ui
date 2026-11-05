import { Check, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError, describeError } from '@wasichai/core'
import { Alert, Button, ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogTitle, Label, Textarea } from '@wasichai/ui'
import { useApproveExecution, useRejectExecution } from './api'
import type { ToolExecution } from './types'

const REASON_MAX = 1000

// approve (it runs once, now) or reject with a reason. 409: decided meanwhile, or the tool changed since the call
export function Decision({ execution, onDecided }: { execution: ToolExecution; onDecided: (decided: ToolExecution) => void }) {
  const { t } = useTranslation(['integration-ai', 'common'])
  const approve = useApproveExecution()
  const reject = useRejectExecution()
  const [asking, setAsking] = useState<'approve' | 'reject' | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const explain = (cause: unknown) =>
    cause instanceof ApiError && cause.status === 409 ? `${describeError(cause)}. ${t('decision.conflict')}` : describeError(cause)

  const open = (which: 'approve' | 'reject') => {
    setError(null)
    setReason('')
    setAsking(which)
  }

  const confirmApprove = async () => {
    setError(null)
    try {
      const decided = await approve.mutateAsync(execution.id)
      setAsking(null)
      onDecided(decided)
    } catch (cause) {
      setError(explain(cause))
    }
  }

  const submitReject = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      const decided = await reject.mutateAsync({ executionId: execution.id, reason })
      setAsking(null)
      onDecided(decided)
    } catch (cause) {
      setError(explain(cause))
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => open('approve')} aria-label={t('decision.approveNamed', { tool: execution.toolName, id: execution.id })}>
          <Check className="size-4" />
          {t('decision.approve')}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => open('reject')}
          aria-label={t('decision.rejectNamed', { tool: execution.toolName, id: execution.id })}
        >
          <X className="size-4" />
          {t('decision.reject')}
        </Button>
      </div>
      {asking === 'approve' ? (
        <ConfirmDialog
          title={t('decision.approveTitle', { tool: execution.toolName })}
          description={t('decision.approveConfirm')}
          confirmLabel={t('decision.approve')}
          variant="primary"
          busy={approve.isPending}
          error={error}
          onConfirm={() => void confirmApprove()}
          onCancel={() => setAsking(null)}
        />
      ) : null}
      {asking === 'reject' ? (
        <Dialog open onOpenChange={(isOpen) => !isOpen && setAsking(null)}>
          <DialogContent className="max-w-md">
            <DialogTitle className="text-lg font-semibold">{t('decision.rejectTitle', { tool: execution.toolName })}</DialogTitle>
            <DialogDescription className="mt-1 text-sm text-ink-muted">{t('decision.rejectHint')}</DialogDescription>
            <form onSubmit={(event) => void submitReject(event)} className="mt-4 space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="reject-reason">{t('decision.reason')}</Label>
                <Textarea id="reject-reason" rows={3} maxLength={REASON_MAX} value={reason} onChange={(event) => setReason(event.target.value)} />
              </div>
              {error ? <Alert tone="danger">{error}</Alert> : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setAsking(null)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={reject.isPending}>
                  {t('decision.reject')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}
