import { useEffect, useRef, useState } from 'react'
import { FileText } from 'lucide-react'
import { parseAsync, renderDocument, type Options } from 'docx-preview'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { openHttpLink } from '@/lib/http-link-routing'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host'
import { docxLinkTarget, withoutExternalDocxResources } from './docx-rendered-content-guard'

function base64Bytes(content: string): Uint8Array {
  const binary = window.atob(content)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

// Why one name for every viewer: each document renders in its own shadow root.
const DOCX_CLASS = 'docx'

async function renderDocx(content: string): Promise<Node[]> {
  const options: Partial<Options> = {
    className: DOCX_CLASS,
    inWrapper: true,
    breakPages: true,
    ignoreLastRenderedPageBreak: true,
    // Why: images as data: URLs, so nothing is left to revoke and the guard can tell them apart.
    useBase64URL: true,
    // Why: an alt chunk is HTML the library frames with srcdoc — same origin as this renderer.
    renderAltChunks: false,
    renderComments: false,
    renderChanges: false,
    experimental: false
  }
  const document = await parseAsync(base64Bytes(content), options)
  return withoutExternalDocxResources(await renderDocument(document, options))
}

/** Resets what the app's styles would pass down, and lets the scroll area's background show. */
function hostStyle(): HTMLStyleElement {
  const style = document.createElement('style')
  style.textContent = `:host { all: initial; display: block; } .${DOCX_CLASS}-wrapper { background: transparent; }`
  return style
}

/**
 * A .docx laid out in pages like Word. It renders in a shadow root: the app's styles stay out of
 * the document, and the document's styles cannot reach the app.
 */
export default function DocxViewer({
  content,
  filePath,
  worktreeId,
  canOpenLocally
}: {
  content: string
  filePath: string
  worktreeId: string
  canOpenLocally: boolean
}): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const [outcome, setOutcome] = useState<{ content: string; ok: boolean } | null>(null)
  const [openFailed, setOpenFailed] = useState(false)
  const status = outcome?.content === content ? (outcome.ok ? 'ready' : 'failed') : 'loading'
  const filename = filePath.split(/[/\\]/).pop() || filePath

  useEffect(() => {
    const host = hostRef.current
    if (!host) {
      return
    }
    // Why reuse: a host takes one shadow root, and Strict Mode runs this effect twice.
    const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
    let disposed = false
    renderDocx(content).then(
      (nodes) => {
        if (!disposed) {
          // Why last: the host style must win over the library's own wrapper background.
          root.replaceChildren(...nodes, hostStyle())
          setOutcome({ content, ok: true })
        }
      },
      () => {
        if (!disposed) {
          setOutcome({ content, ok: false })
        }
      }
    )
    return () => {
      disposed = true
      root.replaceChildren()
    }
  }, [content])

  useEffect(() => {
    const root = hostRef.current?.shadowRoot
    if (!root) {
      return
    }
    const followLink = (event: Event): void => {
      const anchor = event.target instanceof Element ? event.target.closest('a') : null
      if (!anchor) {
        return
      }
      event.preventDefault()
      const target = docxLinkTarget(anchor.getAttribute('href'))
      if (target?.kind === 'bookmark') {
        root.getElementById(target.id)?.scrollIntoView({ block: 'start' })
      } else if (target?.kind === 'web' && event.type === 'click') {
        openHttpLink(target.url, { worktreeId })
      }
    }
    root.addEventListener('click', followLink)
    root.addEventListener('auxclick', followLink)
    return () => {
      root.removeEventListener('click', followLink)
      root.removeEventListener('auxclick', followLink)
    }
  }, [worktreeId])

  return (
    <div className="flex h-full min-h-0 flex-col bg-background" data-orca-docx-viewer>
      <div className="relative min-h-0 flex-1">
        <div className="scrollbar-editor absolute inset-0 overflow-auto bg-muted">
          <div ref={hostRef} />
        </div>
        {status === 'ready' ? null : (
          <div
            role={status === 'failed' ? 'alert' : undefined}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background p-8 text-sm text-muted-foreground"
          >
            {status === 'failed' ? (
              <>
                <FileText size={40} />
                <div>
                  {translate('docxPreview.unavailable', 'Could not display this Word document.')}
                </div>
                <div className="max-w-md break-all text-center text-xs">{filename}</div>
              </>
            ) : (
              translate('auto.components.editor.EditorContent.b2735221f5', 'Loading...')
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-4 border-t px-4 py-2 text-xs text-muted-foreground">
        <span className="min-w-0 truncate" title={filename}>
          {filename}
        </span>
        <span>{translate('docxPreview.label', 'Word document')}</span>
        {canOpenLocally ? (
          <div className="ml-auto flex items-center gap-2">
            {openFailed ? (
              <span role="alert">
                {translate(
                  'docxPreview.openFailed',
                  'Could not open this file in the default app.'
                )}
              </span>
            ) : null}
            <Button
              variant="outline"
              size="xs"
              onClick={async () => {
                try {
                  setOpenFailed(
                    !(await window.api.shell.openFilePath(filePath, LOCAL_EXECUTION_HOST_ID))
                  )
                } catch {
                  setOpenFailed(true)
                }
              }}
            >
              {translate('docxPreview.openDefault', 'Open in Default App')}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
