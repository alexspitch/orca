import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import {
  BUILD_WEB_STATUSES,
  BUILD_WEB_SUBTASK_STATUSES,
  type BuildWebIssueDetail,
  type BuildWebIssuePatch,
  type BuildWebUser,
  type BuildWebVersion
} from '../../../../shared/build-web-types'
import { BUILD_WEB_PRIORITIES } from './build-web-labels'
import { PriorityChip, StatusChip } from './BuildWebToneChip'

const NONE = '__none__'

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}

/** The editable fields of a task — the same set the console's card edits. */
export function BuildWebIssueFields({
  detail,
  assignees,
  versions,
  disabled,
  onSave
}: {
  detail: BuildWebIssueDetail
  assignees: BuildWebUser[]
  versions: BuildWebVersion[]
  disabled: boolean
  onSave: (patch: BuildWebIssuePatch) => void
}): React.JSX.Element {
  const [title, setTitle] = useState(detail.title)
  useEffect(() => setTitle(detail.title), [detail.title])
  const statuses = detail.parent_id ? BUILD_WEB_SUBTASK_STATUSES : BUILD_WEB_STATUSES
  const saveTitle = () => {
    const next = title.trim()
    if (next && next !== detail.title) {
      onSave({ title: next })
    } else {
      setTitle(detail.title)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Field id="build-web-title" label={translate('buildWeb.detail.title', 'Title')}>
        <Input
          id="build-web-title"
          value={title}
          disabled={disabled}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={saveTitle}
          onKeyDown={(event) => event.key === 'Enter' && saveTitle()}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="build-web-status" label={translate('buildWeb.detail.status', 'Status')}>
          <Select
            value={detail.status}
            disabled={disabled}
            onValueChange={(next) => {
              const status = statuses.find((s) => s === next)
              if (status && status !== detail.status) {
                onSave({ status })
              }
            }}
          >
            <SelectTrigger id="build-web-status" size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  <StatusChip status={s} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id="build-web-priority" label={translate('buildWeb.detail.priority', 'Priority')}>
          <Select
            value={String(detail.priority)}
            disabled={disabled}
            onValueChange={(next) => onSave({ priority: Number(next) })}
          >
            <SelectTrigger id="build-web-priority" size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUILD_WEB_PRIORITIES.map((p) => (
                <SelectItem key={p} value={String(p)}>
                  <PriorityChip priority={p} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id="build-web-assignee" label={translate('buildWeb.detail.assignee', 'Assignee')}>
          <Select
            value={detail.assignee || NONE}
            disabled={disabled}
            onValueChange={(next) => onSave({ assignee: next === NONE ? '' : next })}
          >
            <SelectTrigger id="build-web-assignee" size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{translate('buildWeb.detail.nobody', 'Nobody')}</SelectItem>
              {assignees.map((u) => (
                <SelectItem key={u.email} value={u.email}>
                  {u.name || u.email}
                </SelectItem>
              ))}
              {detail.assignee && !assignees.some((u) => u.email === detail.assignee) ? (
                <SelectItem value={detail.assignee}>{detail.assignee}</SelectItem>
              ) : null}
            </SelectContent>
          </Select>
        </Field>
        <Field id="build-web-release" label={translate('buildWeb.detail.release', 'Release')}>
          <Select
            value={detail.version_id ?? NONE}
            disabled={disabled}
            onValueChange={(next) => onSave({ version_id: next === NONE ? null : next })}
          >
            <SelectTrigger id="build-web-release" size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>
                {translate('buildWeb.detail.noRelease', 'No release')}
              </SelectItem>
              {versions.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <label className="flex items-center justify-between gap-3 text-sm">
        {translate('buildWeb.detail.forAi', 'Handed to AI')}
        <Switch
          checked={detail.for_ai}
          disabled={disabled}
          onCheckedChange={(checked) => onSave({ for_ai: checked })}
        />
      </label>
    </div>
  )
}
