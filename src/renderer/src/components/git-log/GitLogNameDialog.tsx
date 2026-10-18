import React, { useId, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import { getBranchPrefixIssue } from '../../../../shared/branch-prefix'

export type GitLogNameInput = { name: string; checked: boolean; message: string }

/** One name to ask for: New Branch, New Tag or Rename. */
export type GitLogNameRequest = {
  title: string
  description: string
  label: string
  initialName: string
  confirmLabel: string
  /** New Branch's "Checkout branch". */
  checkbox?: { label: string; initial: boolean }
  /** New Tag's optional message. */
  messageLabel?: string
  /** Runs the operation; a returned message is shown under the field and keeps the dialog open. */
  submit: (input: GitLogNameInput) => Promise<string | null>
}

function nameIssue(name: string): string | null {
  if (!name) {
    return translate('gitLog.name.empty', 'Enter a name.')
  }
  // Git's own ref rules, the same check branch prefixes get.
  return getBranchPrefixIssue(name)
    ? translate(
        'gitLog.name.invalid',
        'Git doesn’t allow this name: no spaces, ~ ^ : ? * [ \\, “..” or “@{”.'
      )
    : null
}

export function GitLogNameDialog({
  request,
  onClose
}: {
  request: GitLogNameRequest | null
  onClose: () => void
}): React.JSX.Element {
  const nameId = useId()
  const messageId = useId()
  const checkboxId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [checked, setChecked] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [seededFor, setSeededFor] = useState<GitLogNameRequest | null>(null)
  // Why a ref: the operation can finish after the dialog closed or moved on to another request.
  const shownRequest = useRef(request)
  shownRequest.current = request

  // Why during render: the fields must mount already seeded for this request, with no stale frame.
  if (request !== seededFor) {
    setSeededFor(request)
    if (request) {
      setName(request.initialName)
      setChecked(request.checkbox?.initial ?? false)
      setMessage('')
      setError(null)
      setSubmitting(false)
    }
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = name.trim()
    const issue = nameIssue(trimmed)
    if (!request || submitting || issue) {
      setError(issue)
      return
    }
    setSubmitting(true)
    const failure = await request.submit({ name: trimmed, checked, message: message.trim() })
    if (shownRequest.current === request) {
      setSubmitting(false)
      if (failure) {
        setError(failure)
      } else {
        onClose()
      }
    }
  }

  return (
    // Why held open while working: a failure is reported only here, under the field.
    <Dialog open={request !== null} onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent
        className="sm:max-w-md"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          inputRef.current?.focus()
          inputRef.current?.select()
        }}
      >
        <DialogHeader>
          <DialogTitle>{request?.title}</DialogTitle>
          <DialogDescription>{request?.description}</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(event) => void submit(event)}>
          <div className="space-y-1">
            <Label htmlFor={nameId}>{request?.label}</Label>
            <Input
              id={nameId}
              ref={inputRef}
              value={name}
              aria-invalid={error ? true : undefined}
              onChange={(event) => {
                setName(event.target.value)
                setError(null)
              }}
            />
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>
          {request?.messageLabel ? (
            <div className="space-y-1">
              <Label htmlFor={messageId}>{request.messageLabel}</Label>
              <Textarea
                id={messageId}
                value={message}
                rows={3}
                onChange={(event) => setMessage(event.target.value)}
              />
            </div>
          ) : null}
          {request?.checkbox ? (
            <div className="flex items-center gap-2">
              <Checkbox
                id={checkboxId}
                checked={checked}
                onCheckedChange={(value) => setChecked(value === true)}
              />
              <Label htmlFor={checkboxId}>{request.checkbox.label}</Label>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={submitting}
              onClick={onClose}
            >
              {translate('gitLog.name.cancel', 'Cancel')}
            </Button>
            <Button type="submit" size="sm" disabled={submitting || !name.trim()}>
              {submitting ? translate('gitLog.name.working', 'Working…') : request?.confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
