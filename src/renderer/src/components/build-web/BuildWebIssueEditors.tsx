import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import type { BuildWebIssueDetail, BuildWebIssuePatch } from '../../../../shared/build-web-types'
import { BuildWebIssueDescription, BuildWebIssueSteps, SectionTitle } from './BuildWebIssueBody'

// The task's own text edited in place: the title, the description (Markdown) and the steps to
// reproduce (one per line), as build-web's card edits them.

function EditButton({ label, onClick }: { label: string; onClick: () => void }): React.JSX.Element {
  return (
    <Button variant="ghost" size="icon-xs" aria-label={label} title={label} onClick={onClick}>
      <Pencil />
    </Button>
  )
}

function SaveCancel({
  disabled,
  onSave,
  onCancel
}: {
  disabled: boolean
  onSave: () => void
  onCancel: () => void
}): React.JSX.Element {
  return (
    <div className="flex justify-end gap-2">
      <Button variant="ghost" size="sm" onClick={onCancel}>
        {translate('buildWeb.edit.cancel', 'Cancel')}
      </Button>
      <Button size="sm" disabled={disabled} onClick={onSave}>
        {translate('buildWeb.edit.save', 'Save')}
      </Button>
    </div>
  )
}

export function EditableTitle({
  detail,
  saving,
  onSave,
  className
}: {
  detail: BuildWebIssueDetail
  saving: boolean
  onSave: (patch: BuildWebIssuePatch) => void
  className?: string
}): React.JSX.Element {
  const [draft, setDraft] = useState<string | null>(null)
  if (draft === null) {
    return (
      <div className="group flex min-w-0 items-start gap-1">
        <h1 className={className}>{detail.title}</h1>
        <span className="opacity-60 group-hover:opacity-100">
          <EditButton
            label={translate('buildWeb.edit.title', 'Edit the title')}
            onClick={() => setDraft(detail.title)}
          />
        </span>
      </div>
    )
  }
  const save = () => {
    const next = draft.trim()
    if (next && next !== detail.title) {
      onSave({ title: next })
    }
    setDraft(null)
  }
  return (
    <Input
      autoFocus
      value={draft}
      disabled={saving}
      maxLength={500}
      aria-label={translate('buildWeb.detail.title', 'Title')}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          save()
        } else if (event.key === 'Escape') {
          event.stopPropagation()
          setDraft(null)
        }
      }}
    />
  )
}

export function EditableDescription({
  detail,
  canEdit,
  saving,
  onSave
}: {
  detail: BuildWebIssueDetail
  canEdit: boolean
  saving: boolean
  onSave: (patch: BuildWebIssuePatch) => void
}): React.JSX.Element {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <SectionTitle>{translate('buildWeb.detail.description', 'Description')}</SectionTitle>
        {canEdit && draft === null ? (
          <EditButton
            label={translate('buildWeb.edit.description', 'Edit the description')}
            onClick={() => setDraft(detail.description)}
          />
        ) : null}
      </div>
      {draft === null ? (
        <BuildWebIssueDescription detail={detail} />
      ) : (
        <>
          <Textarea
            autoFocus
            value={draft}
            rows={10}
            aria-label={translate('buildWeb.detail.description', 'Description')}
            placeholder={translate('buildWeb.edit.markdown', 'Markdown')}
            onChange={(event) => setDraft(event.target.value)}
          />
          <SaveCancel
            disabled={saving || draft === detail.description}
            onCancel={() => setDraft(null)}
            onSave={() => {
              onSave({ description: draft })
              setDraft(null)
            }}
          />
        </>
      )}
    </section>
  )
}

const stepText = (s: BuildWebIssueDetail['steps'][number]) =>
  s.text ?? [s.action, s.expected].filter(Boolean).join(' → ')

export function EditableSteps({
  detail,
  canEdit,
  saving,
  onSave
}: {
  detail: BuildWebIssueDetail
  canEdit: boolean
  saving: boolean
  onSave: (patch: BuildWebIssuePatch) => void
}): React.JSX.Element {
  const [draft, setDraft] = useState<string | null>(null)
  const current = detail.steps.map(stepText).filter(Boolean).join('\n')
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <SectionTitle>{translate('buildWeb.detail.steps', 'Steps')}</SectionTitle>
        {canEdit && draft === null ? (
          <EditButton
            label={translate('buildWeb.edit.steps', 'Edit the steps')}
            onClick={() => setDraft(current)}
          />
        ) : null}
      </div>
      {draft === null ? (
        current ? (
          <BuildWebIssueSteps detail={detail} />
        ) : (
          <p className="text-sm text-muted-foreground">
            {translate('buildWeb.edit.noSteps', 'No steps.')}
          </p>
        )
      ) : (
        <>
          <Textarea
            autoFocus
            value={draft}
            rows={6}
            aria-label={translate('buildWeb.detail.steps', 'Steps')}
            placeholder={translate('buildWeb.edit.stepPerLine', 'One step per line')}
            onChange={(event) => setDraft(event.target.value)}
          />
          <SaveCancel
            disabled={saving || draft === current}
            onCancel={() => setDraft(null)}
            onSave={() => {
              const steps = draft
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
                .map((text) => ({ text }))
              onSave({ steps })
              setDraft(null)
            }}
          />
        </>
      )}
    </section>
  )
}
