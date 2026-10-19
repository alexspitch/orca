import { useEffect } from 'react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ImeInput } from '@/lib/ime-text-field'
import { translate } from '@/i18n/i18n'

/** Find over a log, at its top-right like the terminal's and the chat's find. */
export function LogFindBar({
  inputRef,
  query,
  onQuery,
  count,
  capped,
  active,
  onStep,
  onClose
}: {
  inputRef: React.RefObject<HTMLInputElement | null>
  query: string
  onQuery: (query: string) => void
  count: number
  capped: boolean
  active: number
  onStep: (direction: 1 | -1) => void
  onClose: () => void
}): React.JSX.Element {
  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [inputRef])

  const status =
    query && count === 0
      ? translate('buildWeb.logView.noResults', 'No results')
      : `${count ? active + 1 : 0}/${count}${capped ? '+' : ''}`
  const previousLabel = translate('buildWeb.logView.previousMatch', 'Previous match')
  const nextLabel = translate('buildWeb.logView.nextMatch', 'Next match')
  const closeLabel = translate('buildWeb.logView.closeFind', 'Close')
  const findLabel = translate('buildWeb.logView.find', 'Find in log')

  return (
    <div
      role="search"
      className="absolute top-2 right-4 z-20 flex w-85 max-w-[calc(100%-2rem)] items-center gap-1 rounded-lg border border-border bg-popover/95 px-2 py-1 text-popover-foreground shadow-floating backdrop-blur-sm"
      onKeyDown={(event) => {
        if (event.key === 'Enter' && event.target === inputRef.current) {
          event.preventDefault()
          onStep(event.shiftKey ? -1 : 1)
        } else if (event.key === 'Escape') {
          // Why: Esc closes the find, not the page behind it.
          event.preventDefault()
          event.stopPropagation()
          onClose()
        }
      }}
    >
      <ImeInput
        ref={inputRef}
        type="text"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder={findLabel}
        aria-label={findLabel}
        className="min-w-0 flex-1 border-none bg-transparent text-sm text-popover-foreground outline-none placeholder:text-muted-foreground"
      />
      <span
        aria-live="polite"
        className="shrink-0 whitespace-nowrap px-1 text-xs tabular-nums text-muted-foreground"
      >
        {status}
      </span>
      <div className="mx-0.5 h-4 w-px bg-border" />
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={() => onStep(-1)}
        disabled={count === 0}
        className="shrink-0"
        title={previousLabel}
        aria-label={previousLabel}
      >
        <ChevronUp size={14} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={() => onStep(1)}
        disabled={count === 0}
        className="shrink-0"
        title={nextLabel}
        aria-label={nextLabel}
      >
        <ChevronDown size={14} />
      </Button>
      <div className="mx-0.5 h-4 w-px bg-border" />
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={onClose}
        className="shrink-0"
        title={closeLabel}
        aria-label={closeLabel}
      >
        <X size={14} />
      </Button>
    </div>
  )
}
