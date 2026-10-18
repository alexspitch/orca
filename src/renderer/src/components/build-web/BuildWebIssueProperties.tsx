import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import {
  BUILD_WEB_ISSUE_TYPES,
  BUILD_WEB_SUBTASK_STATUSES,
  type BuildWebIssueDetail,
  type BuildWebIssuePatch,
  type BuildWebProduct,
  type BuildWebUser,
  type BuildWebVersion
} from '../../../../shared/build-web-types'
import {
  BUILD_WEB_TESTING_STATUSES,
  type BuildWebTestingStatus
} from '../../../../shared/build-web-run-types'
import type { BuildWebTmsStand } from '../../../../shared/build-web-task-types'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import { callBuildWeb } from './build-web-client'
import { BUILD_WEB_PRIORITIES, loginOf, productLabel, typeLabel } from './build-web-labels'
import { PriorityChip, StatusChip, TypeChip } from './BuildWebToneChip'

const NONE = '__none__'
const PRODUCTS: readonly BuildWebProduct[] = ['sa', 'dc', 'ap', 'storage', 'tools']

type Option = { value: string; label: React.ReactNode }

/** A value that reads as text and opens as a list — build-web's InlineSelect. */
function InlineSelect({
  label,
  value,
  options,
  disabled,
  onChange
}: {
  label: string
  value: string
  options: Option[]
  disabled: boolean
  onChange: (value: string) => void
}): React.JSX.Element {
  return (
    <Select value={value} disabled={disabled} onValueChange={onChange}>
      <SelectTrigger size="sm" aria-label={label} className="w-full min-w-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center gap-1">{children}</div>
    </>
  )
}

/**
 * A task's «Properties», after build-web's card: who does it, for which product, stand and release,
 * of what kind and how urgent — and, for a task with builds, where its build is headed. A subtask
 * takes the product, priority, release, stand and build from its parent.
 */
export function BuildWebIssueProperties({
  target,
  detail,
  assignees,
  versions,
  disabled,
  onSave,
  onReload,
  testing,
  onOpenParent
}: {
  target: RuntimeClientTarget
  detail: BuildWebIssueDetail
  assignees: BuildWebUser[]
  versions: BuildWebVersion[]
  disabled: boolean
  onSave: (patch: BuildWebIssuePatch) => Promise<void> | void
  onReload: () => void
  /** Where the build is headed; absent where the card does not read builds. */
  testing?: {
    value: BuildWebTestingStatus
    onChange: (value: BuildWebTestingStatus) => void
  } | null
  onOpenParent?: (id: string) => void
}): React.JSX.Element {
  const child = Boolean(detail.parent_id)
  const [stands, setStands] = useState<BuildWebTmsStand[]>([])
  const [reading, setReading] = useState(false)
  useEffect(() => {
    if (child || detail.product === 'unknown') {
      setStands([])
      return
    }
    let alive = true
    void callBuildWeb(target, 'tmsStands', { product: detail.product }).then(
      (list) => alive && setStands(list),
      () => alive && setStands([])
    )
    return () => {
      alive = false
    }
  }, [child, detail.product, target])
  const busy = disabled || reading

  /** Another stand is another build and another mode: both are read off it and frozen again. */
  const chooseStand = async (standId: string | null) => {
    if (!standId) {
      await onSave({ stand_id: null, stand_mode: '', version: '' })
      return
    }
    setReading(true)
    const read = await callBuildWeb(target, 'standVersion', { standId }).catch(() => null)
    setReading(false)
    await onSave({ stand_id: standId, stand_mode: read?.mode ?? '', version: read?.version ?? '' })
    if (read && !read.version) {
      toast.message(
        read.error ??
          translate('buildWeb.props.noVersion', 'The version could not be read off the stand.')
      )
    }
  }

  const rereadVersion = async () => {
    setReading(true)
    try {
      const result = await callBuildWeb(target, 'refreshIssueVersion', { id: detail.id })
      if (result.ok) {
        toast.success(
          translate('buildWeb.props.versionReread', 'Version read again off the stand.')
        )
        onReload()
      } else {
        toast.error(result.error)
      }
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setReading(false)
    }
  }

  const people: Option[] = [
    { value: NONE, label: translate('buildWeb.props.unassigned', 'Unassigned') },
    ...assignees.map((u) => ({ value: u.email, label: loginOf(u.email) })),
    ...(detail.assignee && !assignees.some((u) => u.email === detail.assignee)
      ? [{ value: detail.assignee, label: loginOf(detail.assignee) }]
      : [])
  ]
  const standOptions: Option[] = [
    { value: NONE, label: translate('buildWeb.props.noStand', 'Not set') },
    ...stands.map((s) => ({ value: s.id, label: s.name })),
    ...(detail.stand_id && !stands.some((s) => s.id === detail.stand_id)
      ? [{ value: detail.stand_id, label: detail.stand_name ?? detail.stand_id }]
      : [])
  ]
  const versionTip = detail.version
    ? translate('buildWeb.props.onStand', 'On the stand: {{version}}{{mode}}', {
        version: detail.version,
        mode: detail.stand_mode ? ` · ${detail.stand_mode}` : ''
      })
    : translate('buildWeb.props.versionUnknown', 'The stand’s version is not read yet')

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 text-sm">
        {child ? (
          <Row label={translate('buildWeb.detail.status', 'Status')}>
            <InlineSelect
              label={translate('buildWeb.props.subtaskStatus', 'Subtask status')}
              value={detail.status}
              disabled={busy}
              onChange={(v) => {
                const status = BUILD_WEB_SUBTASK_STATUSES.find((s) => s === v)
                if (status) {
                  void onSave({ status })
                }
              }}
              options={BUILD_WEB_SUBTASK_STATUSES.map((s) => ({
                value: s,
                label: <StatusChip status={s} />
              }))}
            />
          </Row>
        ) : null}
        <Row label={translate('buildWeb.detail.assignee', 'Assignee')}>
          <InlineSelect
            label={translate('buildWeb.detail.assignee', 'Assignee')}
            value={detail.assignee || NONE}
            disabled={busy}
            onChange={(v) => void onSave({ assignee: v === NONE ? '' : v })}
            options={people}
          />
        </Row>
        {child ? null : (
          <>
            <Row label={translate('buildWeb.props.product', 'Product')}>
              <InlineSelect
                label={translate('buildWeb.props.product', 'Product')}
                value={detail.product === 'unknown' ? NONE : detail.product}
                disabled={busy}
                onChange={(v) => {
                  const product = PRODUCTS.find((p) => p === v)
                  if (product && product !== detail.product) {
                    void onSave({ product })
                  }
                }}
                options={PRODUCTS.map((p) => ({ value: p, label: productLabel(p) }))}
              />
            </Row>
            <Row label={translate('buildWeb.props.stand', 'Stand')}>
              <InlineSelect
                label={translate('buildWeb.props.stand', 'Stand')}
                value={detail.stand_id ?? NONE}
                disabled={busy}
                onChange={(v) => void chooseStand(v === NONE ? null : v)}
                options={standOptions}
              />
              {detail.stand_id ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      disabled={busy}
                      aria-label={translate(
                        'buildWeb.props.reread',
                        'Read the version off the stand again'
                      )}
                      onClick={() => void rereadVersion()}
                    >
                      <RefreshCw className={detail.version ? undefined : 'text-chip-tone-amber'} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {translate('buildWeb.props.reread', 'Read the version off the stand again')}
                    {' · '}
                    {versionTip}
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </Row>
            <Row label={translate('buildWeb.props.version', 'Version')}>
              <InlineSelect
                label={translate('buildWeb.props.productVersion', 'Product version')}
                value={detail.version_id ?? NONE}
                disabled={busy}
                onChange={(v) => void onSave({ version_id: v === NONE ? null : v })}
                options={[
                  { value: NONE, label: translate('buildWeb.props.noVersionSet', 'Not set') },
                  ...versions.map((v) => ({ value: v.id, label: v.name }))
                ]}
              />
            </Row>
          </>
        )}
        <Row label={translate('buildWeb.props.type', 'Type')}>
          <InlineSelect
            label={translate('buildWeb.props.type', 'Type')}
            value={BUILD_WEB_ISSUE_TYPES.find((t) => t === detail.type) ?? NONE}
            disabled={busy}
            onChange={(v) => {
              const type = BUILD_WEB_ISSUE_TYPES.find((t) => t === v)
              if (type && type !== detail.type) {
                void onSave({ type })
              }
            }}
            options={[
              ...(BUILD_WEB_ISSUE_TYPES.some((t) => t === detail.type)
                ? []
                : [{ value: NONE, label: typeLabel(detail.type) }]),
              ...BUILD_WEB_ISSUE_TYPES.map((t) => ({ value: t, label: <TypeChip type={t} /> }))
            ]}
          />
        </Row>
        {child ? null : (
          <Row label={translate('buildWeb.detail.priority', 'Priority')}>
            <InlineSelect
              label={translate('buildWeb.detail.priority', 'Priority')}
              value={String(detail.priority)}
              disabled={busy}
              onChange={(v) => void onSave({ priority: Number(v) })}
              options={BUILD_WEB_PRIORITIES.map((p) => ({
                value: String(p),
                label: <PriorityChip priority={p} />
              }))}
            />
          </Row>
        )}
        {testing && !child ? (
          <Row label={translate('buildWeb.props.testing', 'Testing')}>
            <InlineSelect
              label={translate('buildWeb.props.testing', 'Testing')}
              value={testing.value}
              disabled={busy}
              onChange={(v) => {
                const next = BUILD_WEB_TESTING_STATUSES.find((s) => s === v)
                if (next) {
                  testing.onChange(next)
                }
              }}
              options={BUILD_WEB_TESTING_STATUSES.map((s) => ({ value: s, label: s }))}
            />
          </Row>
        ) : null}
        <Row label={translate('buildWeb.detail.forAi', 'Handed to AI')}>
          <Switch
            checked={detail.for_ai}
            disabled={busy}
            onCheckedChange={(checked) => void onSave({ for_ai: checked })}
          />
        </Row>
      </div>
      {child && detail.parent_id ? (
        <p className="text-2xs text-muted-foreground">
          {translate(
            'buildWeb.props.fromParent',
            'Product, priority, version, stand and build — from the parent'
          )}{' '}
          <button
            type="button"
            className="font-mono text-primary hover:underline"
            onClick={() => detail.parent_id && onOpenParent?.(detail.parent_id)}
          >
            {detail.parent_key}
          </button>
          .
        </p>
      ) : null}
    </div>
  )
}
