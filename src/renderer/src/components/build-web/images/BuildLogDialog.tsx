import { useLayoutEffect, useRef } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { translate } from '@/i18n/i18n'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { useBuildLogViewer } from './build-log-viewer'
import { useBuildLog } from './use-build-log'

const NEAR_BOTTOM_PX = 40

function LogBody({ target, url }: { target: RuntimeClientTarget; url: string }): React.JSX.Element {
  const { text, done, trimmed, error } = useBuildLog(target, url)
  const scroller = useRef<HTMLDivElement | null>(null)
  // Why: the newest lines stay in view while the build writes, unless the reader scrolled up.
  const following = useRef(true)
  useLayoutEffect(() => {
    const el = scroller.current
    if (el && following.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [text])
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {done ? (
          translate('buildWeb.log.finished', 'The build is over.')
        ) : (
          <>
            <Loader2 className="size-3 animate-spin" />
            {translate('buildWeb.log.following', 'Following the log…')}
          </>
        )}
        {trimmed ? (
          <span>{translate('buildWeb.log.trimmed', 'Earlier lines are not shown.')}</span>
        ) : null}
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={() => void window.api.shell.openUrl(url)}>
          {translate('buildWeb.log.openInBrowser', 'Open in browser')}
          <ExternalLink />
        </Button>
      </div>
      <div
        ref={scroller}
        onScroll={(event) => {
          const el = event.currentTarget
          following.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
        }}
        className="scrollbar-sleek h-[65vh] overflow-auto rounded-md border border-border bg-muted/40 p-3"
      >
        <pre className="font-mono text-xs leading-5 whitespace-pre-wrap [overflow-wrap:anywhere]">
          {text}
        </pre>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** The build log in a dialog, kept scrolled to its newest lines while the build goes. */
export function BuildLogDialog({ target }: { target: RuntimeClientTarget }): React.JSX.Element {
  const log = useBuildLogViewer((s) => s.log)
  const hide = useBuildLogViewer((s) => s.hide)
  return (
    <Dialog open={log !== null} onOpenChange={(open) => !open && hide()}>
      <DialogContent className="sm:max-w-[min(1100px,92vw)]">
        <DialogHeader>
          <DialogTitle>
            <span className="font-mono text-sm">{log?.title}</span>
          </DialogTitle>
          <DialogDescription>{translate('buildWeb.log.title', 'Build log')}</DialogDescription>
        </DialogHeader>
        {log ? <LogBody key={log.url} target={target} url={log.url} /> : null}
      </DialogContent>
    </Dialog>
  )
}
