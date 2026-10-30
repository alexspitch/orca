import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { ChevronDown, Plus, Trash2, TriangleAlert, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useConfirmationDialog } from '@/components/confirmation-dialog-context'
import { translate } from '@/i18n/i18n'
import type { BuildWebSavedQuery } from '../../../../../shared/build-web-saved-query-types'
import { BUILD_WEB_PRODUCTS } from '../../../../../shared/build-web-types'
import { callBuildWeb } from '../build-web-client'
import { ProductChip } from '../BuildWebToneChip'
import { useBuildWebTarget } from '../use-build-web-data'
import { SaveQueryDialog } from './SaveQueryDialog'
import { closeQueryTab, openQueryTab } from './query-tabs'
import { viewOfSavedFilter } from './saved-query-filter'

function unsupportedLabel(field: string): string {
  switch (field) {
    case 'type':
      return translate('buildWeb.savedQueries.field.type', 'type')
    case 'version':
      return translate('buildWeb.savedQueries.field.version', 'version')
    case 'verdict':
      return translate('buildWeb.savedQueries.field.verdict', 'verdict')
    case 'author':
      return translate('buildWeb.savedQueries.field.author', 'author')
    case 'stand':
      return translate('buildWeb.savedQueries.field.stand', 'stand')
    case 'mode':
      return translate('buildWeb.savedQueries.field.mode', 'mode')
    case 'jira':
      return translate('buildWeb.savedQueries.field.noJira', 'not in Jira')
    case 'dates':
      return translate('buildWeb.savedQueries.field.dates', 'dates')
    case 'rootOnly':
      return translate('buildWeb.savedQueries.field.rootOnly', 'top-level only')
    default:
      return field
  }
}

const unsupportedText = (fields: readonly string[]) =>
  translate('buildWeb.savedQueries.unsupported', 'Orca’s list does not narrow by: {{fields}}', {
    fields: fields.map(unsupportedLabel).join(', ')
  })

function QueryRow({
  query,
  onDelete
}: {
  query: BuildWebSavedQuery
  onDelete: () => void
}): React.JSX.Element {
  const { unsupported } = viewOfSavedFilter(query.filter)
  return (
    <>
      <span className="min-w-0 flex-1 truncate">{query.name}</span>
      {BUILD_WEB_PRODUCTS.filter((p) => query.filter.product.includes(p)).map((p) => (
        <ProductChip key={p} product={p} />
      ))}
      {query.shared ? (
        <Users
          className="size-3.5 text-muted-foreground"
          aria-label={translate('buildWeb.savedQueries.sharedBy', 'Shared by {{owner}}', {
            owner: query.owner
          })}
        />
      ) : null}
      {unsupported.length ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <TriangleAlert className="size-3.5 text-chip-tone-amber" />
          </TooltipTrigger>
          <TooltipContent side="right">{unsupportedText(unsupported)}</TooltipContent>
        </Tooltip>
      ) : null}
      {query.mine ? (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={translate('buildWeb.savedQueries.delete', 'Delete «{{name}}»', {
            name: query.name
          })}
          onClick={(event) => {
            // Why: the row's own click applies the query.
            event.preventDefault()
            event.stopPropagation()
            onDelete()
          }}
        >
          <Trash2 />
        </Button>
      ) : null}
    </>
  )
}

/** The List tab's saved queries: build-web's saved filters of the Issues table, run and deleted here. */
export function SavedQueriesMenu(): React.JSX.Element {
  const { target } = useBuildWebTarget()
  const confirm = useConfirmationDialog()
  const [queries, setQueries] = useState<BuildWebSavedQuery[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      // Why every product: a query switches the list's product, and its list must not change with it.
      setQueries(await callBuildWeb(target, 'savedQueries', { products: [...BUILD_WEB_PRODUCTS] }))
      setError(null)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    }
  }, [target])

  const apply = (query: BuildWebSavedQuery) => {
    const unsupported = openQueryTab(query)
    if (unsupported.length) {
      toast.warning(query.name, { description: unsupportedText(unsupported) })
    }
  }

  const remove = async (query: BuildWebSavedQuery) => {
    const accepted = await confirm({
      title: translate('buildWeb.savedQueries.deleteTitle', 'Delete «{{name}}»?', {
        name: query.name
      }),
      description: query.shared
        ? translate(
            'buildWeb.savedQueries.deleteShared',
            'It is shared: it goes for everybody, in build-web too.'
          )
        : translate('buildWeb.savedQueries.deleteOwn', 'It goes in build-web too.'),
      confirmLabel: translate('buildWeb.savedQueries.deleteConfirm', 'Delete')
    })
    if (!accepted) {
      return
    }
    try {
      const result = await callBuildWeb(target, 'deleteQuery', { id: query.id })
      if (result.ok) {
        setQueries((current) => current?.filter((q) => q.id !== query.id) ?? null)
        closeQueryTab(query.id)
      } else {
        toast.error(result.error)
      }
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : String(failure))
    }
  }

  return (
    <>
      <DropdownMenu onOpenChange={(open) => open && void load()}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="my-auto"
                aria-label={translate('buildWeb.savedQueries.open', 'Saved queries')}
              >
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            {translate('buildWeb.savedQueries.open', 'Saved queries')}
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start" className="w-80">
          <DropdownMenuLabel>
            {translate('buildWeb.savedQueries.open', 'Saved queries')}
          </DropdownMenuLabel>
          {error ? <p className="px-2 py-1 text-xs text-destructive">{error}</p> : null}
          {queries === null && !error ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">
              {translate('buildWeb.savedQueries.loading', 'Loading…')}
            </p>
          ) : null}
          {queries?.length === 0 ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">
              {translate('buildWeb.savedQueries.none', 'No saved queries yet')}
            </p>
          ) : null}
          {queries?.map((query) => (
            <DropdownMenuItem key={query.id} onSelect={() => apply(query)}>
              <QueryRow query={query} onDelete={() => void remove(query)} />
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setSaving(true)}>
            <Plus />
            {translate('buildWeb.savedQueries.saveCurrent', 'Save current query…')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SaveQueryDialog
        open={saving}
        target={target}
        known={queries ?? []}
        onSaved={() => setSaving(false)}
        onClose={() => setSaving(false)}
      />
    </>
  )
}
