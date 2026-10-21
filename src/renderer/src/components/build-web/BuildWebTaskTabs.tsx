import { List } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ACTIVE_TAB_INDICATOR_CLASSES, getTabRootStateClasses } from '../tab-bar/drop-indicator'
import { EditorFileTabCloseButton } from '../tab-bar/EditorFileTabCloseButton'
import { useBuildWebStore } from './build-web-store'
import {
  activeTaskTabId,
  closeTaskTab,
  showTaskList,
  showTaskTab,
  useTaskTabsOf,
  type BuildWebTaskTab
} from './build-web-task-tabs'

const TAB_CLASSES =
  'group relative flex h-full shrink-0 cursor-pointer items-center gap-1.5 border-r border-border px-2.5 text-xs outline-none select-none first:border-l focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset'

/** The list and every task opened in full, as tabs over the Issues page. */
export function BuildWebTaskTabs(): React.JSX.Element | null {
  const contextKey = useBuildWebStore((s) => s.contextKey)
  const activeId = useBuildWebStore(activeTaskTabId)
  const tabs = useTaskTabsOf(contextKey)
  if (tabs.length === 0) {
    return null
  }
  const listActive = !tabs.some((tab) => tab.id === activeId)
  return (
    <div
      role="tablist"
      aria-label={translate('buildWeb.tabs.label', 'Open tasks')}
      className="scrollbar-none flex h-8 shrink-0 items-stretch overflow-x-auto border-b border-border px-3 md:px-5"
    >
      <div
        role="tab"
        tabIndex={0}
        aria-selected={listActive}
        onClick={showTaskList}
        onKeyDown={(event) => activateOnKey(event, showTaskList)}
        className={cn(TAB_CLASSES, getTabRootStateClasses(listActive))}
      >
        {listActive ? <span className={ACTIVE_TAB_INDICATOR_CLASSES} aria-hidden /> : null}
        <List className="size-3.5" />
        {translate('buildWeb.tabs.list', 'List')}
      </div>
      {tabs.map((tab) => (
        <TaskTab key={tab.id} tab={tab} active={tab.id === activeId} />
      ))}
    </div>
  )
}

function TaskTab({ tab, active }: { tab: BuildWebTaskTab; active: boolean }): React.JSX.Element {
  const show = (): void => showTaskTab(tab.id)
  const name = tab.key ?? translate('buildWeb.tabs.task', 'Task')
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          role="tab"
          tabIndex={0}
          aria-selected={active}
          onClick={show}
          onKeyDown={(event) => activateOnKey(event, show)}
          onMouseDown={(event) => {
            // Why: a middle press would start autoscroll before the click closes the tab.
            if (event.button === 1) {
              event.preventDefault()
            }
          }}
          onAuxClick={(event) => {
            if (event.button === 1) {
              event.preventDefault()
              closeTaskTab(tab.id)
            }
          }}
          className={cn(TAB_CLASSES, 'pr-1.5', getTabRootStateClasses(active))}
        >
          {active ? <span className={ACTIVE_TAB_INDICATOR_CLASSES} aria-hidden /> : null}
          <span className="font-mono text-muted-foreground">{name}</span>
          {tab.title ? <span className="max-w-48 truncate">{tab.title}</span> : null}
          <EditorFileTabCloseButton
            fileIsDirty={false}
            showsSelectionChrome={active}
            onClose={() => closeTaskTab(tab.id)}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent>{tab.title ? `${name} · ${tab.title}` : name}</TooltipContent>
    </Tooltip>
  )
}

function activateOnKey(event: React.KeyboardEvent, activate: () => void): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    activate()
  }
}
