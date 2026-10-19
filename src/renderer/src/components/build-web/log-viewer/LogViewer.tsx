import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { getShortcutPlatform } from '@/lib/shortcut-platform'
import { cn } from '@/lib/utils'
import { visibleLogLines, type LogLines } from './log-lines'
import { advanceLogSearch, matchesOnLine, type LogMatch, type LogSearch } from './log-search'
import { LogFindBar } from './LogFindBar'

const NEAR_BOTTOM_PX = 40
const ROW_ESTIMATE_PX = 20

function LogRow({
  text,
  matches,
  active
}: {
  text: string
  matches: LogMatch[]
  active: LogMatch | null
}): React.JSX.Element {
  if (!matches.length) {
    return <>{text || ' '}</>
  }
  const parts: React.ReactNode[] = []
  let at = 0
  for (const match of matches) {
    if (match.start > at) {
      parts.push(text.slice(at, match.start))
    }
    parts.push(
      <mark
        key={match.start}
        className={cn(
          'log-viewer-match',
          active?.line === match.line && active.start === match.start && 'log-viewer-match-active'
        )}
      >
        {text.slice(match.start, match.end)}
      </mark>
    )
    at = match.end
  }
  parts.push(text.slice(at))
  return <>{parts}</>
}

/**
 * A log that may be long and may grow: rows are windowed, the view keeps to the newest line until
 * the reader scrolls up, and Cmd/Ctrl+F finds in what is loaded.
 */
export function LogViewer({
  log,
  toolbar,
  trailing,
  emptyLabel,
  className
}: {
  log: LogLines
  /** The owner's controls, at the left of the toolbar. */
  toolbar?: React.ReactNode
  /** The owner's controls after Find, at its right end. */
  trailing?: React.ReactNode
  emptyLabel?: string
  className?: string
}): React.JSX.Element {
  const rows = useMemo(() => visibleLogLines(log), [log])
  const scroller = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const following = useRef(true)
  const [atBottom, setAtBottom] = useState(true)
  const [findOpen, setFindOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const revealNewest = useRef(false)
  const searchRef = useRef<LogSearch | null>(null)
  const search = useMemo(() => {
    const next = advanceLogSearch(searchRef.current, log, findOpen ? query : '')
    searchRef.current = next
    return next
  }, [log, query, findOpen])
  const matches = search.matches
  const activeIndex = Math.min(active, matches.length - 1)
  const activeMatch = activeIndex >= 0 ? matches[activeIndex] : null

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_ESTIMATE_PX,
    overscan: 20
  })

  const reveal = (match: LogMatch): void => {
    following.current = false
    setAtBottom(false)
    virtualizer.scrollToIndex(match.line - log.first, { align: 'center' })
  }

  useLayoutEffect(() => {
    const el = scroller.current
    if (el && following.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [rows])

  // Why: a new query lands on its newest match — in a log, the latest is what is looked for.
  useLayoutEffect(() => {
    const newest = matches.at(-1)
    if (!revealNewest.current || !newest) {
      return
    }
    revealNewest.current = false
    setActive(matches.length - 1)
    following.current = false
    setAtBottom(false)
    virtualizer.scrollToIndex(newest.line - log.first, { align: 'center' })
  }, [matches, log.first, virtualizer])

  const openFind = (): void => {
    if (findOpen) {
      inputRef.current?.focus()
      inputRef.current?.select()
    } else {
      setFindOpen(true)
    }
  }
  const changeQuery = (next: string): void => {
    setQuery(next)
    revealNewest.current = next.length > 0
  }
  const step = (direction: 1 | -1): void => {
    if (!matches.length) {
      return
    }
    const next = (activeIndex + direction + matches.length) % matches.length
    setActive(next)
    reveal(matches[next])
  }
  const jumpToLatest = (): void => {
    following.current = true
    setAtBottom(true)
    const el = scroller.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }

  const mac = getShortcutPlatform() === 'darwin'
  const findLabel = translate('buildWeb.logView.find', 'Find in log')
  return (
    <div
      className={cn('flex min-h-0 flex-1 flex-col gap-2', className)}
      onKeyDown={(event) => {
        if ((mac ? event.metaKey : event.ctrlKey) && event.key.toLowerCase() === 'f') {
          event.preventDefault()
          openFind()
        }
      }}
    >
      <div className="flex min-h-7 items-center gap-2 text-xs text-muted-foreground">
        {toolbar}
        <div className="flex-1" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label={findLabel} onClick={openFind}>
              <Search />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={4}>
            {findLabel}
          </TooltipContent>
        </Tooltip>
        {trailing}
      </div>
      <div className="relative min-h-0 flex-1">
        {findOpen ? (
          <LogFindBar
            inputRef={inputRef}
            query={query}
            onQuery={changeQuery}
            count={matches.length}
            capped={search.capped}
            active={Math.max(activeIndex, 0)}
            onStep={step}
            onClose={() => {
              setFindOpen(false)
              setQuery('')
              scroller.current?.focus()
            }}
          />
        ) : null}
        <div
          ref={scroller}
          tabIndex={0}
          onScroll={(event) => {
            const el = event.currentTarget
            const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
            following.current = near
            setAtBottom(near)
          }}
          className="scrollbar-sleek h-full overflow-auto rounded-md border border-border bg-muted/40 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {rows.length === 0 ? (
            <p className="px-3 text-xs text-muted-foreground">{emptyLabel}</p>
          ) : (
            <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
              {virtualizer.getVirtualItems().map((item) => (
                <div
                  key={item.key}
                  data-index={item.index}
                  ref={virtualizer.measureElement}
                  className="absolute top-0 left-0 w-full px-3 font-mono text-xs leading-5 whitespace-pre-wrap [overflow-wrap:anywhere]"
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  <LogRow
                    text={rows[item.index]}
                    matches={matches.length ? matchesOnLine(matches, log.first + item.index) : []}
                    active={activeMatch}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        {atBottom ? null : (
          <Button
            variant="outline"
            size="xs"
            className="absolute bottom-3 left-1/2 -translate-x-1/2"
            onClick={jumpToLatest}
          >
            <ArrowDown />
            {translate('buildWeb.logView.latest', 'Latest')}
          </Button>
        )}
      </div>
    </div>
  )
}
