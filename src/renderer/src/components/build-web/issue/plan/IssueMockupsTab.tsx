import { useEffect, useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type {
  BuildWebIssueDetail,
  BuildWebMockupView
} from '../../../../../../shared/build-web-types'
import type { RuntimeClientTarget } from '../../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../../build-web-client'
import { filesWithRole } from './issue-file-roles'
import { AttachHint } from './IssuePlanTab'

const ROW =
  'block w-full truncate rounded-md px-2 py-1 text-left text-xs hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

/**
 * The task's mockups — a page, or an archive of pages — in a frame, as build-web shows them. The
 * frame runs the mockup's scripts on an opaque origin: never `allow-same-origin`, and the console
 * serves the same sandbox in its own policy.
 */
export function IssueMockupsTab({
  target,
  detail
}: {
  target: RuntimeClientTarget
  detail: BuildWebIssueDetail
}): React.JSX.Element {
  const mockups = filesWithRole(detail.files, 'mockup')
  const [chosenId, setChosenId] = useState<string | null>(null)
  const chosen = mockups.find((m) => m.id === chosenId) ?? mockups[0] ?? null
  const [view, setView] = useState<BuildWebMockupView | null>(null)
  const [screen, setScreen] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // A fresh address each time a mockup is opened: one works for a few hours only.
  const chosenFileId = chosen?.id ?? null
  useEffect(() => {
    if (!chosenFileId) {
      return
    }
    let alive = true
    setView(null)
    setScreen(null)
    setError(null)
    callBuildWeb(target, 'issueMockupView', { id: detail.id, fileId: chosenFileId }).then(
      (next) => {
        if (alive) {
          setView(next)
          setScreen(next.screens[0]?.path ?? null)
        }
      },
      (failure) => alive && setError(failure instanceof Error ? failure.message : String(failure))
    )
    return () => {
      alive = false
    }
  }, [target, detail.id, chosenFileId])

  if (!chosen) {
    return (
      <AttachHint
        text={translate(
          'buildWeb.mockups.none',
          'The task has no mockups. Attach a page or a zip of pages with'
        )}
        command={`bw.sh attach ${detail.key} <mockup.html|mockups.zip> --mockup`}
      />
    )
  }
  const current = view?.screens.find((s) => s.path === screen) ?? null
  const url = view && current ? `${view.base}${current.path}` : null
  // The list is only worth its width when there is something to choose from.
  const showList = mockups.length > 1 || (view?.screens.length ?? 0) > 1
  return (
    <div className="flex h-full min-h-96 gap-3">
      {showList ? (
        <nav
          aria-label={translate('buildWeb.mockups.list', 'Mockups and screens')}
          className="scrollbar-sleek flex w-64 shrink-0 flex-col gap-0.5 overflow-y-auto"
        >
          {mockups.map((m) => (
            <div key={m.id} className="flex flex-col gap-0.5">
              <button
                type="button"
                aria-current={m.id === chosen.id ? 'true' : undefined}
                onClick={() => setChosenId(m.id)}
                className={cn(ROW, 'font-mono', m.id === chosen.id && 'bg-accent')}
                title={m.name}
              >
                {m.name}
              </button>
              {m.id === chosen.id && view && view.screens.length > 1
                ? view.screens.map((s) => (
                    <button
                      key={s.path}
                      type="button"
                      aria-current={s.path === screen ? 'true' : undefined}
                      onClick={() => setScreen(s.path)}
                      className={cn(ROW, 'pl-5', s.path === screen && 'bg-accent')}
                      title={s.name}
                    >
                      {s.name.split('/').pop()}
                    </button>
                  ))
                : null}
            </div>
          ))}
        </nav>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
            {current?.name ?? chosen.name}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={!url}
            onClick={() => url && void window.api.shell.openUrl(url)}
          >
            <ExternalLink />
            {translate('buildWeb.mockups.openInBrowser', 'Open in browser')}
          </Button>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {!error && !view ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
        {view && !url ? (
          <p className="text-sm text-muted-foreground">
            {translate('buildWeb.mockups.noPages', 'The archive holds no .html page.')}
          </p>
        ) : null}
        {url ? (
          <iframe
            // Why the key: another screen is a new document, not a navigation of this one.
            key={url}
            title={current?.name ?? chosen.name}
            // SECURITY: never add allow-same-origin; a mockup is HTML anyone attached.
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            src={url}
            className="min-h-0 w-full flex-1 rounded-md border border-border"
          />
        ) : null}
      </div>
    </div>
  )
}
