import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { BuildWebRecap } from '../../../../../shared/build-web-recap-types'
import { ProductChip } from '../BuildWebToneChip'

const when = (iso: string) => (iso ? new Date(iso).toLocaleString() : '')

function startedBy(recap: BuildWebRecap): string {
  if (recap.trigger === 'scheduled') {
    return translate('buildWeb.recaps.scheduled', 'scheduled')
  }
  return recap.started_by?.split('@')[0] || translate('buildWeb.recaps.byHand', 'by hand')
}

/** The finished reports, newest first, a page at a time; the row picked shows its report. */
export function RecapList({
  recaps,
  selectedId,
  onSelect,
  page,
  pageSize,
  total,
  loading,
  onPage
}: {
  recaps: BuildWebRecap[]
  selectedId: string | null
  onSelect: (id: string) => void
  page: number
  pageSize: number
  total: number
  loading: boolean
  onPage: (page: number) => void
}): React.JSX.Element {
  const first = page * pageSize
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul className="scrollbar-sleek min-h-0 flex-1 overflow-auto">
        {recaps.map((r) => {
          const current = r.id === selectedId
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onSelect(r.id)}
                aria-current={current ? 'true' : undefined}
                data-current={current ? 'true' : undefined}
                className={cn(
                  'flex w-full flex-col gap-1 border-b border-border/60 px-3 py-2 text-left transition-colors hover:bg-accent',
                  current && 'bg-accent'
                )}
              >
                <span className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{r.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {when(r.finished_at)}
                  </span>
                </span>
                <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <ProductChip product={r.product} />
                  {r.version ? <span className="truncate">{r.version.name}</span> : null}
                  {r.commit ? <span className="font-mono">{r.commit.slice(0, 8)}</span> : null}
                  <span className="ml-auto shrink-0">{startedBy(r)}</span>
                </span>
              </button>
            </li>
          )
        })}
        {recaps.length === 0 && !loading ? (
          <li className="p-3 text-xs text-muted-foreground">
            {translate('buildWeb.recaps.emptyPage', 'Nothing on this page')}
          </li>
        ) : null}
      </ul>
      {total > pageSize ? (
        <div className="flex items-center gap-1 border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
          <span className="flex-1 tabular-nums">
            {translate('buildWeb.recaps.range', '{{from}}–{{to}} of {{total}}', {
              from: first + 1,
              to: Math.min(first + pageSize, total),
              total
            })}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={page === 0 || loading}
            aria-label={translate('buildWeb.recaps.newer', 'Newer reports')}
            onClick={() => onPage(page - 1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={first + pageSize >= total || loading}
            aria-label={translate('buildWeb.recaps.older', 'Older reports')}
            onClick={() => onPage(page + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      ) : null}
    </div>
  )
}
