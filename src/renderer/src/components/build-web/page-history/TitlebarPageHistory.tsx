import { ArrowLeft, ArrowRight, Check, History } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import {
  backIndex,
  forwardIndex,
  isPageHistoryView,
  pageEntryKey,
  recentPages,
  usePageHistory
} from './page-history-store'
import { goBackPage, goForwardPage, pageLabel, showPage } from './page-history-navigation'

/**
 * Back and Forward through the pages opened inside Orca, and the last ten of them — apart from the
 * workspace pair beside it, which switches workspaces.
 */
export function TitlebarPageHistory({ separated }: { separated: boolean }): React.JSX.Element {
  const entries = usePageHistory((s) => s.entries)
  const index = usePageHistory((s) => s.index)
  const onPage = useAppStore((s) => isPageHistoryView(s.activeView))
  const state = { entries, index }
  const back = backIndex({ ...state, shownRecap: null }, onPage)
  const forward = forwardIndex({ ...state, shownRecap: null })
  const recentLabel = translate('buildWeb.history.recent', 'Recent pages')
  const backLabel =
    back === null
      ? translate('buildWeb.history.back', 'Back')
      : translate('buildWeb.history.backTo', 'Back to {{page}}', {
          page: pageLabel(entries[back])
        })
  const forwardLabel =
    forward === null
      ? translate('buildWeb.history.forward', 'Forward')
      : translate('buildWeb.history.forwardTo', 'Forward to {{page}}', {
          page: pageLabel(entries[forward])
        })
  return (
    <div
      role="group"
      aria-label={translate('buildWeb.history.label', 'Page history')}
      className={cn('flex items-center', separated && 'ml-1 border-l border-border pl-1')}
    >
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button className="sidebar-toggle sidebar-toggle-compact" aria-label={recentLabel}>
                <History size={12} />
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {recentLabel}
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start" className="max-w-96">
          <DropdownMenuLabel>{recentLabel}</DropdownMenuLabel>
          {recentPages(state).map(({ entry, index: at }) => (
            <DropdownMenuItem key={pageEntryKey(entry)} onSelect={() => showPage(at)}>
              <Check className={cn(!(onPage && at === index) && 'invisible')} />
              <span className="truncate">{pageLabel(entry)}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="sidebar-toggle sidebar-toggle-compact"
            onClick={goBackPage}
            disabled={back === null}
            aria-label={backLabel}
          >
            <ArrowLeft size={12} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {backLabel}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="sidebar-toggle sidebar-toggle-compact"
            onClick={goForwardPage}
            disabled={forward === null}
            aria-label={forwardLabel}
          >
            <ArrowRight size={12} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {forwardLabel}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
