import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'
import type { BuildWebSavedQuery } from '../../../../../shared/build-web-saved-query-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'
import { useBuildWebStore } from '../build-web-store'
import { savedFilterOfView, storageProductOf } from './saved-query-filter'

// Why a separate form: it mounts per opening, so it starts from the filters of that moment.
function SaveQueryForm({
  target,
  known,
  onSaved,
  onClose
}: {
  target: RuntimeClientTarget
  known: readonly BuildWebSavedQuery[]
  onSaved: (query: BuildWebSavedQuery) => void
  onClose: () => void
}): React.JSX.Element {
  const quick = useBuildWebStore((s) => s.quick)
  const statuses = useBuildWebStore((s) => s.statuses)
  const query = useBuildWebStore((s) => s.query)
  const products = useBuildWebStore((s) => s.products)
  const assignees = useBuildWebStore((s) => s.assignees)
  const view = { quick, statuses, query, products, assignees }
  const [name, setName] = useState('')
  const [shared, setShared] = useState(false)
  const [saving, setSaving] = useState(false)
  const trimmed = name.trim()
  const sameName = known.filter((q) => q.mine && q.name.toLowerCase() === trimmed.toLowerCase())

  const save = async () => {
    setSaving(true)
    try {
      const filter = savedFilterOfView(view)
      const result = await callBuildWeb(target, 'saveQuery', {
        product: storageProductOf(filter),
        name: trimmed,
        shared,
        filter
      })
      if (result.ok) {
        // Why: the console keys a name by the product it is kept under; in Orca a name is one query.
        await Promise.all(
          sameName
            .filter((q) => q.id !== result.value.id)
            .map((q) => callBuildWeb(target, 'deleteQuery', { id: q.id }).catch(() => null))
        )
        toast.success(
          translate('buildWeb.savedQueries.saved', 'Saved «{{name}}»', { name: trimmed })
        )
        onSaved(result.value)
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (trimmed && !saving) {
          void save()
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>{translate('buildWeb.savedQueries.saveTitle', 'Save query')}</DialogTitle>
        <DialogDescription>
          {translate(
            'buildWeb.savedQueries.saveDescription',
            'The quick filters, statuses, products, assignees and search of the list, kept in build-web with its saved filters.'
          )}
        </DialogDescription>
      </DialogHeader>
      <Input
        autoFocus
        value={name}
        maxLength={200}
        onChange={(event) => setName(event.target.value)}
        placeholder={translate('buildWeb.savedQueries.name', 'Name')}
        aria-label={translate('buildWeb.savedQueries.name', 'Name')}
      />
      {sameName.length ? (
        <p className="-mt-2 text-xs text-muted-foreground">
          {translate('buildWeb.savedQueries.replaces', 'Replaces your query of the same name.')}
        </p>
      ) : null}
      <label className="flex items-start gap-2 text-sm">
        <Checkbox
          emphasis="strong"
          checked={shared}
          onCheckedChange={(v) => setShared(v === true)}
        />
        <span>
          {translate('buildWeb.savedQueries.shared', 'Shared')}
          <span className="block text-xs text-muted-foreground">
            {translate(
              'buildWeb.savedQueries.sharedHint',
              'Everybody sees it; only you can delete it.'
            )}
          </span>
        </span>
      </label>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          {translate('buildWeb.savedQueries.cancel', 'Cancel')}
        </Button>
        <Button type="submit" disabled={!trimmed || saving}>
          {translate('buildWeb.savedQueries.save', 'Save')}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Keeps the list's current filters in build-web under a name. */
export function SaveQueryDialog({
  open,
  target,
  known,
  onSaved,
  onClose
}: {
  open: boolean
  target: RuntimeClientTarget
  known: readonly BuildWebSavedQuery[]
  onSaved: (query: BuildWebSavedQuery) => void
  onClose: () => void
}): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        {open ? (
          <SaveQueryForm target={target} known={known} onSaved={onSaved} onClose={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
