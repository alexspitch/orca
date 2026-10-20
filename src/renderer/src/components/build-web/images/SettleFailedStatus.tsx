import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useConfirmationDialog } from '@/components/confirmation-dialog-context'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { useBuildWebBadgeKick } from '@/components/sidebar/use-build-web-badge'
import type { BuildWebImageBuild } from '../../../../../shared/build-web-image-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'
import { BuildWebToneChip } from '../BuildWebToneChip'
import { imageBuildTone } from '../build-web-tones'
import { buildStatusLabel, formatBuildTime } from './image-build-cells'

const messageOf = (failure: unknown) =>
  failure instanceof Error ? failure.message : String(failure)

/**
 * The «failed» of an image whose release line has built before: a click offers that build in the
 * failed one's place. The console rewrites the runs that hold the failure; nothing is built.
 */
export function SettleFailedStatus({
  target,
  failed,
  success,
  onSettled
}: {
  target: RuntimeClientTarget
  failed: BuildWebImageBuild
  success: BuildWebImageBuild
  onSettled: () => void
}): React.JSX.Element {
  const confirm = useConfirmationDialog()
  const kickBadge = useBuildWebBadgeKick()
  const [busy, setBusy] = useState(false)
  const to = success.number
  const settle = async (): Promise<void> => {
    const build = [`#${to}`, success.tag, formatBuildTime(success.at)].filter(Boolean).join(' · ')
    const accepted = await confirm({
      title: translate('buildWeb.images.settleTitle', 'Use build #{{to}} of {{image}}?', {
        to,
        image: failed.image
      }),
      description: translate(
        'buildWeb.images.settleBody',
        'Failed build #{{number}} on {{dist}} is replaced, in this table and in the runs that hold it, by the newest successful build of the same version: {{build}}. Nothing is built.',
        { number: failed.number, dist: failed.dist, build }
      ),
      confirmLabel: translate('buildWeb.images.settle', 'Use #{{to}}', { to })
    })
    if (!accepted) {
      return
    }
    setBusy(true)
    try {
      const result = await callBuildWeb(target, 'adoptImageSuccess', {
        image: failed.image,
        dist: failed.dist,
        number: failed.number,
        to
      })
      if (!result.ok) {
        toast.error(
          result.routeMissing
            ? translate(
                'buildWeb.images.settleUnsupported',
                'This build-web console cannot do that yet. Update the console.'
              )
            : result.error
        )
        return
      }
      toast.success(
        translate('buildWeb.images.settled', '{{image}} on {{dist}} now names build #{{to}}.', {
          image: failed.image,
          dist: failed.dist,
          to
        })
      )
      kickBadge()
      onSettled()
    } catch (failure) {
      toast.error(messageOf(failure))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          disabled={busy}
          onClick={() => void settle()}
          className="inline-flex items-center gap-1 rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-3 animate-spin text-muted-foreground" /> : null}
          <BuildWebToneChip label={buildStatusLabel('failed')} tone={imageBuildTone('failed')} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {translate(
          'buildWeb.images.settleHint',
          '{{status}} — use the last successful build #{{to}} instead, without building',
          { status: failed.raw_status, to }
        )}
      </TooltipContent>
    </Tooltip>
  )
}
