import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'

/** Empty, loading and error states of the list — one place, so they read the same everywhere. */
export function BuildWebListState({
  kind,
  error,
  onRetry,
  loadingLabel
}: {
  kind: 'loading' | 'empty' | 'error'
  error?: string | null
  onRetry?: () => void
  /** What is loading, when it is not the task list. */
  loadingLabel?: string
}): React.JSX.Element | null {
  const [showLoading, setShowLoading] = useState(false)
  useEffect(() => {
    if (kind !== 'loading') {
      return
    }
    // Why: a quick answer should not flash a placeholder (STYLEGUIDE, UX rule 1).
    const timer = window.setTimeout(() => setShowLoading(true), 200)
    return () => window.clearTimeout(timer)
  }, [kind])

  if (kind === 'loading') {
    return showLoading ? (
      <p className="px-3 py-10 text-center text-sm text-muted-foreground md:px-5">
        {loadingLabel ?? translate('buildWeb.state.loading', 'Loading tasks…')}
      </p>
    ) : null
  }
  if (kind === 'error') {
    return (
      <div className="flex flex-col items-center gap-3 px-3 py-10 text-center md:px-5">
        <p role="alert" className="max-w-lg text-sm text-destructive">
          {error}
        </p>
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            {translate('buildWeb.state.retry', 'Try again')}
          </Button>
        ) : null}
      </div>
    )
  }
  return (
    <p className="px-3 py-10 text-center text-sm text-muted-foreground md:px-5">
      {translate('buildWeb.state.noneMatch', 'No tasks match these filters.')}
    </p>
  )
}
