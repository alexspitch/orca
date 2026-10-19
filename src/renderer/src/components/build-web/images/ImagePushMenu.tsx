import { useState } from 'react'
import { CloudUpload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import type { BuildWebImageBuild } from '../../../../../shared/build-web-image-types'
import {
  offersBuildTagOnly,
  offersMainTag,
  pushRequests
} from '../../../../../shared/build-web-image-push'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'
import { pushKeyOf, useImagePushes } from './image-push-runs'

/**
 * «Push to registry» for the picked builds. The choice in the menu is the confirmation: the build
 * tag alone is offered first, the moving main tag only where it can still go.
 */
export function ImagePushMenu({
  target,
  builds,
  onPushed
}: {
  target: RuntimeClientTarget
  builds: BuildWebImageBuild[]
  /** After a push: `refused` names the runs whose request did not go, so their picks stay. */
  onPushed: (refused: ReadonlySet<string>) => void
}): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const track = useImagePushes((s) => s.track)
  const push = async (moveMainTag: boolean): Promise<void> => {
    setBusy(true)
    // Why every run is asked: one refused (an image gone from the build host) must not cost the rest.
    const refused = new Map<string, string>()
    let started = 0
    for (const request of pushRequests(builds, moveMainTag)) {
      const images = request.combos.map((c) => c.image).join(', ')
      try {
        const result = await callBuildWeb(target, 'pushImages', request)
        if (!result.ok) {
          refused.set(request.runId, `${images} — ${result.error}`)
          continue
        }
        started += request.combos.length
        track({ runId: request.runId, keys: request.combos.map(pushKeyOf), startedAt: Date.now() })
      } catch (error) {
        refused.set(
          request.runId,
          `${images} — ${error instanceof Error ? error.message : String(error)}`
        )
      }
    }
    setBusy(false)
    if (started > 0) {
      toast.success(
        translate(
          'buildWeb.images.pushStartedCount',
          'Push of {{count}} image(s) started — build-web publishes the tags.',
          { count: started }
        )
      )
    }
    if (refused.size > 0) {
      toast.error(
        translate('buildWeb.images.pushRefused', 'Not pushed: {{why}}', {
          why: [...refused.values()].join('; ')
        })
      )
    }
    onPushed(new Set(refused.keys()))
  }
  const label = builds.length
    ? translate('buildWeb.images.pushCount', 'Push to registry ({{count}})', {
        count: builds.length
      })
    : translate('buildWeb.images.push', 'Push to registry')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={busy || builds.length === 0}>
          <CloudUpload />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          {translate('buildWeb.images.pushWhat', 'What to publish')}
        </DropdownMenuLabel>
        {offersBuildTagOnly(builds) ? (
          <DropdownMenuItem onSelect={() => void push(false)}>
            {translate('buildWeb.images.pushBuildTag', 'Build tag only')}
          </DropdownMenuItem>
        ) : null}
        {offersMainTag(builds) ? (
          <DropdownMenuItem onSelect={() => void push(true)}>
            {offersBuildTagOnly(builds)
              ? translate('buildWeb.images.pushBoth', 'Build tag and main tag')
              : translate('buildWeb.images.pushMain', 'Main tag')}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
