import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import CommentMarkdown from '@/components/sidebar/CommentMarkdown'
import { translate } from '@/i18n/i18n'

/**
 * The guide's own card, after build-web's Guide: generate or regenerate it, keep the built images
 * current, save hand edits, and revise it by a comment — Markdown on the left, the comment as it
 * will read on the right.
 */
export function GuideEditor({
  guide,
  preview,
  note,
  hasTicket,
  hasBuild,
  canWrite,
  streaming,
  refreshing,
  saved,
  onEdit,
  onGenerate,
  onRefreshImages,
  onSave,
  onRevise
}: {
  guide: string
  /** The guide with its screenshots resolved, for the preview. */
  preview: string
  note: string
  hasTicket: boolean
  hasBuild: boolean
  canWrite: boolean
  streaming: boolean
  refreshing: boolean
  saved: boolean
  onEdit: (text: string) => void
  onGenerate: () => void
  onRefreshImages: () => void
  onSave: () => void
  onRevise: (feedback: string) => void
}): React.JSX.Element {
  const [feedback, setFeedback] = useState('')
  const revise = () => {
    if (feedback.trim() && guide) {
      onRevise(feedback.trim())
      setFeedback('')
    }
  }
  const generateLabel = streaming
    ? translate('buildWeb.guide.generating', 'Generating…')
    : guide
      ? translate('buildWeb.guide.regenerate', 'Regenerate')
      : translate('buildWeb.guide.generate', 'Generate')
  return (
    <section className="flex h-[calc(100dvh-260px)] min-h-[560px] min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-60 flex-1 flex-col gap-0.5">
          <h2 className="text-sm font-semibold">
            {translate('buildWeb.guide.title', 'Feature guide')}
          </h2>
          <p className="text-xs text-muted-foreground">
            {note}
            {hasBuild
              ? ''
              : ` ${translate('buildWeb.guide.noBuilt', 'No image is built yet — the «Built images» section will be empty.')}`}
          </p>
        </div>
        {canWrite ? (
          <>
            <Button size="sm" disabled={streaming || !hasTicket} onClick={onGenerate}>
              <Sparkles />
              {generateLabel}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={streaming || refreshing || !guide}
              onClick={onRefreshImages}
            >
              {refreshing
                ? translate('buildWeb.guide.refreshing', 'Refreshing…')
                : translate('buildWeb.guide.refreshImages', 'Refresh images')}
            </Button>
            <Button variant="outline" size="sm" disabled={streaming || !guide} onClick={onSave}>
              {saved
                ? translate('buildWeb.guide.savedShort', 'Saved')
                : translate('buildWeb.guide.saveEdits', 'Save edits')}
            </Button>
          </>
        ) : null}
      </div>
      {!hasTicket ? (
        <p className="text-xs text-muted-foreground">
          {translate(
            'buildWeb.guide.noTicket',
            'This build has no ticket — no guide can be built from a diff.'
          )}
        </p>
      ) : null}
      {!guide && !streaming ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border p-6 text-center">
          <p className="text-sm font-semibold">
            {translate('buildWeb.guide.noneYet', 'No guide yet')}
          </p>
          <p className="max-w-lg text-xs text-muted-foreground">
            {translate(
              'buildWeb.guide.explain',
              'The model reads the task’s changes and writes the guide: what changed, how to check it, which images are built and where it lives in the code. The text can be edited by hand and revised by a comment.'
            )}
          </p>
          {canWrite ? (
            <Button size="sm" disabled={!hasTicket} onClick={onGenerate}>
              {translate('buildWeb.guide.generate', 'Generate')}
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2">
            <div className="flex min-h-0 flex-col gap-1.5">
              <label
                htmlFor="build-web-guide-src"
                className="text-xs font-medium text-muted-foreground"
              >
                {translate('buildWeb.guide.markdownEdit', 'Markdown · edited by hand')}
              </label>
              <Textarea
                id="build-web-guide-src"
                variant="code"
                value={guide}
                readOnly={!canWrite || streaming}
                onChange={(event) => onEdit(event.target.value)}
                className="min-h-0 flex-1 resize-none"
              />
            </div>
            <div className="flex min-h-0 min-w-0 flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {translate('buildWeb.guide.previewAs', 'Preview · as the comment will read')}
              </span>
              <div className="scrollbar-sleek min-h-0 flex-1 overflow-auto rounded-md border border-border bg-background px-4 py-3">
                <CommentMarkdown
                  content={preview}
                  variant="document"
                  expandImages
                  growing={streaming}
                  className="text-sm"
                />
              </div>
            </div>
          </div>
          {canWrite ? (
            <div className="flex items-end gap-2 border-t border-border pt-3">
              <div className="flex flex-1 flex-col gap-1.5">
                <label htmlFor="build-web-guide-revise" className="text-xs text-muted-foreground">
                  {translate('buildWeb.guide.revise', 'Revise by a comment')}{' '}
                  <span className="text-muted-foreground/70">
                    {translate('buildWeb.guide.reviseShortcut', '· Ctrl+Enter')}
                  </span>
                </label>
                <Input
                  id="build-web-guide-revise"
                  value={feedback}
                  placeholder={translate(
                    'buildWeb.guide.revisePlaceholder',
                    'e.g. shorter; add an example for sampling'
                  )}
                  onChange={(event) => setFeedback(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                      revise()
                    }
                  }}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={streaming || !feedback.trim() || !guide}
                onClick={revise}
              >
                {translate('buildWeb.guide.reviseButton', 'Revise')}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
