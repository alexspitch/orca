import { useMemo } from 'react'
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
import { logLinesOf } from '../log-viewer/log-lines'
import { LogViewer } from '../log-viewer/LogViewer'
import { useBuildLogViewer } from './build-log-viewer'
import { useBuildLog } from './use-build-log'

// Why: useBuildLog already keeps the tail by characters; this only bounds the line count.
const KEEP_LINES = 100_000

function LogBody({
  target,
  url,
  test,
  webUrl
}: {
  target: RuntimeClientTarget
  url: string
  test: boolean
  webUrl: string
}): React.JSX.Element {
  const { text, done, trimmed, error } = useBuildLog(target, url)
  const log = useMemo(() => logLinesOf(text, KEEP_LINES), [text])
  return (
    <div className="flex h-[65vh] min-h-0 flex-col gap-2">
      <LogViewer
        log={log}
        toolbar={
          <>
            {done ? (
              test ? (
                translate('buildWeb.log.complete', 'The log is complete.')
              ) : (
                translate('buildWeb.log.finished', 'The build is over.')
              )
            ) : (
              <>
                <Loader2 className="size-3 animate-spin" />
                {translate('buildWeb.log.following', 'Following the log…')}
              </>
            )}
            {trimmed ? (
              <span>{translate('buildWeb.log.trimmed', 'Earlier lines are not shown.')}</span>
            ) : null}
          </>
        }
        trailing={
          <Button variant="ghost" size="sm" onClick={() => void window.api.shell.openUrl(webUrl)}>
            {translate('buildWeb.log.openInBrowser', 'Open in browser')}
            <ExternalLink />
          </Button>
        }
      />
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
          <DialogDescription>
            {log?.kind === 'test'
              ? translate('buildWeb.log.testTitle', 'Test log')
              : translate('buildWeb.log.title', 'Build log')}
          </DialogDescription>
        </DialogHeader>
        {log ? (
          <LogBody
            key={log.url}
            target={target}
            url={log.url}
            test={log.kind === 'test'}
            webUrl={log.webUrl ?? log.url}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
