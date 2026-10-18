import { Fragment, useState } from 'react'
import { translate } from '@/i18n/i18n'
import { BuildWebToneChip } from '../BuildWebToneChip'
import type { ChipTone } from '../build-web-tones'
import { useBuildLogViewer } from '../images/build-log-viewer'
import type { WindowImage, WindowImageState } from './train-window'
import { splitTarget, tagGroups } from './train-image-refs'

const GRID =
  'grid grid-cols-[100px_minmax(200px,1.1fr)_64px_72px_minmax(280px,2fr)] items-center gap-x-4'
// Tags shown before «+N»: the build tag and its moving tag cover most rows.
const TAGS_SHOWN = 3

function imageState(state: WindowImageState): { label: string; tone: ChipTone | null } {
  switch (state) {
    case 'built':
      return { label: translate('buildWeb.trains.imageBuilt', 'built'), tone: 'green' }
    case 'building':
      return { label: translate('buildWeb.trains.imageBuilding', 'building'), tone: 'blue' }
    case 'failed':
      return { label: translate('buildWeb.trains.imageFailed', 'failed'), tone: 'red' }
    case 'aborted':
      return { label: translate('buildWeb.trains.imageAborted', 'aborted'), tone: 'amber' }
    case 'kept':
      return { label: translate('buildWeb.trains.imageKept', 'not rebuilt'), tone: 'neutral' }
    case 'waiting':
      return { label: translate('buildWeb.trains.imageWaiting', 'not built'), tone: 'neutral' }
  }
}

/** The registries and tags of one image; past TAGS_SHOWN the rest open on «+N». */
function ImageTags({ tags, note }: { tags: string[]; note: string }): React.JSX.Element {
  const [all, setAll] = useState(false)
  if (tags.length === 0) {
    return <span className="truncate text-muted-foreground">{note || '—'}</span>
  }
  let left = all ? Number.POSITIVE_INFINITY : TAGS_SHOWN
  const hidden = Math.max(0, tags.length - TAGS_SHOWN)
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {tagGroups(tags).map((g) => {
        const shown = g.tags.slice(0, Math.max(0, left))
        left -= shown.length
        if (shown.length === 0) {
          return null
        }
        return (
          <Fragment key={g.registry}>
            {g.registry ? (
              <span className="font-mono text-muted-foreground">{g.registry}</span>
            ) : null}
            {shown.map((tag) => (
              <span
                key={tag}
                className="rounded-sm border border-border px-1.5 font-mono leading-5"
              >
                {tag}
              </span>
            ))}
          </Fragment>
        )
      })}
      {!all && hidden > 0 ? (
        <button
          type="button"
          aria-label={translate('buildWeb.trains.moreTags', 'Show {{n}} more', {
            n: String(hidden)
          })}
          onClick={() => setAll(true)}
          className="rounded-sm border border-dashed border-border px-1.5 font-mono leading-5 text-muted-foreground hover:bg-accent"
        >
          +{hidden}
        </button>
      ) : null}
    </div>
  )
}

/** The window's images: what became of each, its build, and where it was published. */
export function TrainRunImages({ images }: { images: WindowImage[] }): React.JSX.Element {
  if (images.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {translate('buildWeb.trains.nothingToBuild', 'nothing to build')}
      </p>
    )
  }
  return (
    <div className="scrollbar-sleek overflow-x-auto rounded-md border border-border">
      <div className="min-w-[860px] text-xs">
        <div className={`${GRID} min-h-8 bg-muted/50 px-4 font-medium text-muted-foreground`}>
          <span>{translate('buildWeb.trains.status', 'Status')}</span>
          <span>{translate('buildWeb.trains.image', 'Image')}</span>
          <span>{translate('buildWeb.trains.os', 'OS')}</span>
          <span>{translate('buildWeb.trains.build', 'Build')}</span>
          <span>{translate('buildWeb.trains.registryTags', 'Registry and tags')}</span>
        </div>
        {images.map((i) => {
          const { name, namespace, dist } = splitTarget(i.target)
          const state = imageState(i.state)
          return (
            <div key={i.target} className={`${GRID} border-t border-border px-4 py-2.5`}>
              <span>
                <BuildWebToneChip label={state.label} tone={state.tone} />
              </span>
              <span className="flex min-w-0 flex-col font-mono">
                <span className="truncate text-sm">{name}</span>
                {namespace ? (
                  <span className="truncate text-2xs text-muted-foreground">{namespace}</span>
                ) : null}
              </span>
              <span>
                {dist ? (
                  <span className="rounded-sm bg-muted px-1.5 font-mono leading-5 text-muted-foreground">
                    {dist}
                  </span>
                ) : null}
              </span>
              <span className="font-mono text-sm">
                {i.build_number === null ? (
                  '—'
                ) : i.build_url ? (
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() =>
                      i.build_url &&
                      useBuildLogViewer
                        .getState()
                        .show(i.build_url, `${i.target} #${i.build_number}`)
                    }
                  >
                    #{i.build_number}
                  </button>
                ) : (
                  `#${i.build_number}`
                )}
              </span>
              <ImageTags tags={i.tags} note={i.note} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
