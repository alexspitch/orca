import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import {
  BUILD_WEB_ISSUE_TYPES,
  BUILD_WEB_PRODUCTS,
  BUILD_WEB_STATUSES,
  type BuildWebIssueDraft,
  type BuildWebIssueRow,
  type BuildWebProduct,
  type BuildWebStatus,
  type BuildWebVersion
} from '../../../../shared/build-web-types'
import type { BuildWebTmsStand } from '../../../../shared/build-web-task-types'
import { stepsOfLines } from '../../../../shared/build-web-issue-steps'
import { callBuildWeb } from './build-web-client'
import { BUILD_WEB_PRIORITIES, loginOf, productLabel } from './build-web-labels'
import { useBuildWebStore } from './build-web-store'
import { useBuildWebAssignees, useBuildWebTarget } from './use-build-web-data'
import { InlineSelect, PropertyRow } from './BuildWebIssueProperties'
import { PriorityChip, StatusChip, TypeChip } from './BuildWebToneChip'

const NONE = '__none__'
type IssueType = (typeof BUILD_WEB_ISSUE_TYPES)[number]
type Stand = { id: string; mode: string; version: string }

/** The release and stand lists of the chosen product; a late answer for another product is dropped. */
function useProductLists(product: BuildWebProduct | null): {
  versions: BuildWebVersion[]
  stands: BuildWebTmsStand[]
} {
  const { target } = useBuildWebTarget()
  const [lists, setLists] = useState<{
    product: BuildWebProduct
    versions: BuildWebVersion[]
    stands: BuildWebTmsStand[]
  } | null>(null)
  useEffect(() => {
    if (!product) {
      return
    }
    let alive = true
    void Promise.all([
      callBuildWeb(target, 'listVersions', { product }).catch(() => []),
      callBuildWeb(target, 'tmsStands', { product }).catch(() => [])
    ]).then(([versions, stands]) => alive && setLists({ product, versions, stands }))
    return () => {
      alive = false
    }
  }, [product, target])
  return lists && lists.product === product ? lists : { versions: [], stands: [] }
}

// Why a separate form: it mounts per opening, so it starts empty and from the list's product.
function NewIssueForm({
  onCreated,
  onClose
}: {
  onCreated: (issue: Omit<BuildWebIssueRow, 'favorite'>) => void
  onClose: () => void
}): React.JSX.Element {
  const { target } = useBuildWebTarget()
  const filtered = useBuildWebStore((s) => s.products)
  const [product, setProduct] = useState<BuildWebProduct | null>(() =>
    filtered.size === 1 ? ([...filtered][0] ?? null) : null
  )
  const [title, setTitle] = useState('')
  const [type, setType] = useState<IssueType>('bug')
  const [status, setStatus] = useState<BuildWebStatus>('todo')
  const [priority, setPriority] = useState(3)
  const [assignee, setAssignee] = useState('')
  const [versionId, setVersionId] = useState<string | null>(null)
  const [stand, setStand] = useState<Stand | null>(null)
  const [forAi, setForAi] = useState(false)
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState('')
  const [reading, setReading] = useState(false)
  const [saving, setSaving] = useState(false)
  const people = useBuildWebAssignees(true)
  const { versions, stands } = useProductLists(product)
  const trimmed = title.trim()

  const chooseProduct = (next: BuildWebProduct) => {
    if (next !== product) {
      setProduct(next)
      // Why: a release and a stand belong to one product, as the console's product change clears them.
      setVersionId(null)
      setStand(null)
    }
  }

  /** The stand's build and mode are read off it and frozen, as the card does. */
  const chooseStand = async (standId: string | null) => {
    if (!standId) {
      setStand(null)
      return
    }
    setReading(true)
    const read = await callBuildWeb(target, 'standVersion', { standId }).catch(() => null)
    setReading(false)
    setStand({ id: standId, mode: read?.mode ?? '', version: read?.version ?? '' })
    if (read && !read.version) {
      toast.message(
        read.error ??
          translate('buildWeb.props.noVersion', 'The version could not be read off the stand.')
      )
    }
  }

  const create = async () => {
    if (!product || !trimmed) {
      return
    }
    const lines = stepsOfLines(steps)
    const draft: BuildWebIssueDraft = {
      product,
      title: trimmed,
      type,
      status,
      priority,
      assignee,
      for_ai: forAi,
      ...(versionId ? { version_id: versionId } : {}),
      ...(stand ? { stand_id: stand.id, stand_mode: stand.mode, version: stand.version } : {}),
      ...(description.trim() ? { description } : {}),
      ...(lines.length ? { steps: lines } : {})
    }
    setSaving(true)
    try {
      const result = await callBuildWeb(target, 'createIssue', { draft })
      if (result.ok) {
        toast.success(
          translate('buildWeb.create.created', 'Created {{key}}', { key: result.value.key })
        )
        onCreated(result.value)
      } else {
        toast.error(result.error)
      }
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setSaving(false)
    }
  }

  const busy = saving || reading
  return (
    <form
      className="flex min-h-0 flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (!busy) {
          void create()
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>{translate('buildWeb.create.title', 'New task')}</DialogTitle>
        <DialogDescription>
          {translate(
            'buildWeb.create.description',
            'build-web numbers the task from the product’s counter.'
          )}
        </DialogDescription>
      </DialogHeader>
      <Input
        autoFocus
        value={title}
        maxLength={500}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={translate('buildWeb.create.name', 'Title')}
        aria-label={translate('buildWeb.create.name', 'Title')}
      />
      <div className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 text-sm">
        <PropertyRow label={translate('buildWeb.props.product', 'Product')}>
          <InlineSelect
            label={translate('buildWeb.props.product', 'Product')}
            value={product ?? NONE}
            disabled={busy}
            onChange={(v) => {
              const next = BUILD_WEB_PRODUCTS.find((p) => p === v)
              if (next) {
                chooseProduct(next)
              }
            }}
            options={[
              ...(product
                ? []
                : [{ value: NONE, label: translate('buildWeb.create.chooseProduct', 'Choose') }]),
              ...BUILD_WEB_PRODUCTS.map((p) => ({ value: p, label: productLabel(p) }))
            ]}
          />
        </PropertyRow>
        <PropertyRow label={translate('buildWeb.props.type', 'Type')}>
          <InlineSelect
            label={translate('buildWeb.props.type', 'Type')}
            value={type}
            disabled={busy}
            onChange={(v) => {
              const next = BUILD_WEB_ISSUE_TYPES.find((t) => t === v)
              if (next) {
                setType(next)
              }
            }}
            options={BUILD_WEB_ISSUE_TYPES.map((t) => ({ value: t, label: <TypeChip type={t} /> }))}
          />
        </PropertyRow>
        <PropertyRow label={translate('buildWeb.detail.status', 'Status')}>
          <InlineSelect
            label={translate('buildWeb.detail.status', 'Status')}
            value={status}
            disabled={busy}
            onChange={(v) => {
              const next = BUILD_WEB_STATUSES.find((s) => s === v)
              if (next) {
                setStatus(next)
              }
            }}
            options={BUILD_WEB_STATUSES.map((s) => ({
              value: s,
              label: <StatusChip status={s} />
            }))}
          />
        </PropertyRow>
        <PropertyRow label={translate('buildWeb.detail.priority', 'Priority')}>
          <InlineSelect
            label={translate('buildWeb.detail.priority', 'Priority')}
            value={String(priority)}
            disabled={busy}
            onChange={(v) => setPriority(Number(v))}
            options={BUILD_WEB_PRIORITIES.map((p) => ({
              value: String(p),
              label: <PriorityChip priority={p} />
            }))}
          />
        </PropertyRow>
        <PropertyRow label={translate('buildWeb.detail.assignee', 'Assignee')}>
          <InlineSelect
            label={translate('buildWeb.detail.assignee', 'Assignee')}
            value={assignee || NONE}
            disabled={busy}
            onChange={(v) => setAssignee(v === NONE ? '' : v)}
            options={[
              { value: NONE, label: translate('buildWeb.props.unassigned', 'Unassigned') },
              ...people.map((u) => ({ value: u.email, label: loginOf(u.email) }))
            ]}
          />
        </PropertyRow>
        <PropertyRow label={translate('buildWeb.props.version', 'Version')}>
          <InlineSelect
            label={translate('buildWeb.props.productVersion', 'Product version')}
            value={versionId ?? NONE}
            disabled={busy || !product}
            onChange={(v) => setVersionId(v === NONE ? null : v)}
            options={[
              { value: NONE, label: translate('buildWeb.props.noVersionSet', 'Not set') },
              ...versions.map((v) => ({ value: v.id, label: v.name }))
            ]}
          />
        </PropertyRow>
        <PropertyRow label={translate('buildWeb.props.stand', 'Stand')}>
          <InlineSelect
            label={translate('buildWeb.props.stand', 'Stand')}
            value={stand?.id ?? NONE}
            disabled={busy || !product}
            onChange={(v) => void chooseStand(v === NONE ? null : v)}
            options={[
              { value: NONE, label: translate('buildWeb.props.noStand', 'Not set') },
              ...stands.map((s) => ({ value: s.id, label: s.name }))
            ]}
          />
        </PropertyRow>
        <PropertyRow label={translate('buildWeb.detail.forAi', 'Handed to AI')}>
          <Switch checked={forAi} disabled={busy} onCheckedChange={setForAi} />
        </PropertyRow>
      </div>
      <Textarea
        value={description}
        rows={6}
        aria-label={translate('buildWeb.detail.description', 'Description')}
        placeholder={translate('buildWeb.create.descriptionPlaceholder', 'Description, Markdown')}
        onChange={(event) => setDescription(event.target.value)}
      />
      <Textarea
        value={steps}
        rows={3}
        aria-label={translate('buildWeb.detail.steps', 'Steps')}
        placeholder={translate('buildWeb.create.stepsPlaceholder', 'Steps, one per line')}
        onChange={(event) => setSteps(event.target.value)}
      />
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          {translate('buildWeb.create.cancel', 'Cancel')}
        </Button>
        <Button type="submit" disabled={!product || !trimmed || busy}>
          {translate('buildWeb.create.submit', 'Create')}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** A new build-web task, with every field the console's create takes but the parent. */
export function BuildWebNewIssueDialog({
  open,
  onCreated,
  onClose
}: {
  open: boolean
  onCreated: (issue: Omit<BuildWebIssueRow, 'favorite'>) => void
  onClose: () => void
}): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto scrollbar-sleek sm:max-w-xl">
        {open ? <NewIssueForm onCreated={onCreated} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  )
}
