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
  onPushed: () => void
}): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const push = async (moveMainTag: boolean): Promise<void> => {
    setBusy(true)
    try {
      for (const request of pushRequests(builds, moveMainTag)) {
        const result = await callBuildWeb(target, 'pushImages', request)
        if (!result.ok) {
          toast.error(result.error)
          return
        }
      }
      toast.success(
        translate('buildWeb.images.pushStarted', 'Push started — build-web publishes the tags.')
      )
      onPushed()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
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
