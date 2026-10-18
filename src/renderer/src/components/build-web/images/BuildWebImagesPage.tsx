import { useState } from 'react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { useBuildWebStore } from '../build-web-store'
import { useBuildWebStatus, useBuildWebTarget } from '../use-build-web-data'
import { useBuildWebPageEscape } from '../use-build-web-page-escape'
import { BuildWebConnect } from '../BuildWebConnect'
import { BuildWebListState } from '../BuildWebListState'
import { ImageListView } from './ImageListView'
import { ImageHistoryView } from './ImageHistoryView'
import { BuildLogDialog } from './BuildLogDialog'

/** build-web's Images section: the newest build of every image, and one image's history. */
export default function BuildWebImagesPage(): React.JSX.Element {
  const closePage = useAppStore((s) => s.closeBuildWebImagesPage)
  const { target, contextKey } = useBuildWebTarget()
  const { refreshStatus } = useBuildWebStatus()
  const status = useBuildWebStore((s) => (s.contextKey === contextKey ? s.status : null))
  const error = useBuildWebStore((s) => s.error)
  const setStatus = useBuildWebStore((s) => s.setStatus)
  const [image, setImage] = useState<string | null>(null)

  useBuildWebPageEscape(() => (image ? setImage(null) : closePage()))

  const connected = status?.connected === true
  return (
    <main className="relative flex h-full min-h-0 flex-1 flex-col bg-background pt-5 text-foreground md:pt-6">
      <header
        className="flex shrink-0 items-center gap-3 px-3 pb-3 md:px-5"
        // Why: no stacked titlebar on this page; keep the header clear of the window controls.
        style={{ paddingRight: 'max(0.75rem, var(--window-controls-width, 0px))' }}
      >
        <h1 className="truncate text-base leading-8 font-semibold">
          {translate('buildWeb.images.title', 'Images')}
        </h1>
        <div className="flex-1" />
        {connected ? (
          <span className="truncate text-xs text-muted-foreground">
            {status.login} · {status.baseUrl?.replace(/^https?:\/\//, '')}
          </span>
        ) : null}
      </header>
      {status === null ? (
        <BuildWebListState
          kind={error ? 'error' : 'loading'}
          error={error}
          onRetry={() => void refreshStatus()}
          loadingLabel={translate('buildWeb.images.loading', 'Loading images…')}
        />
      ) : !connected ? (
        <BuildWebConnect target={target} onConnected={(next) => setStatus(contextKey, next)} />
      ) : image ? (
        <ImageHistoryView
          target={target}
          image={image}
          baseUrl={status.baseUrl}
          onBack={() => setImage(null)}
        />
      ) : (
        <ImageListView target={target} onOpenImage={setImage} />
      )}
      <BuildLogDialog target={target} />
    </main>
  )
}
