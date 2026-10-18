import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type { BuildWebIssueRow } from '../../../../shared/build-web-types'
import { useBuildWebStore } from './build-web-store'
import { batchCheckMessage, validateBuildWebBatch } from './build-web-take-to-work'
import { BuildWebToneChip, ProductChip } from './BuildWebToneChip'

/** The picked tasks and «Take to work», refused for a mix of products or releases. */
export function BuildWebSelectionBar({
  onTakeToWork
}: {
  onTakeToWork: (issues: BuildWebIssueRow[]) => void
}): React.JSX.Element | null {
  const issues = useBuildWebStore((s) => s.issues)
  const selected = useBuildWebStore((s) => s.selected)
  const clear = useBuildWebStore((s) => s.clearSelection)
  const picked = issues.filter((i) => selected.has(i.id))
  if (picked.length === 0) {
    return null
  }
  const check = validateBuildWebBatch(picked)
  const reason = batchCheckMessage(check)
  const takeButton = (
    <Button size="sm" disabled={!check.ok} onClick={() => onTakeToWork(picked)}>
      {translate('buildWeb.take.button', 'Take to work ({{count}})', { count: picked.length })}
    </Button>
  )
  return (
    <div className="m-3 flex flex-wrap items-center gap-3 rounded-md border border-border bg-card px-3 py-2 md:mx-5">
      <span className="text-sm font-medium">
        {translate('buildWeb.take.selected', '{{count}} selected', { count: picked.length })}
      </span>
      {check.ok ? (
        <span className="flex items-center gap-1.5">
          <ProductChip product={picked[0].product} />
          <BuildWebToneChip
            label={picked[0].version_name ?? translate('buildWeb.detail.noRelease', 'No release')}
            tone={null}
            mono={Boolean(picked[0].version_name)}
          />
        </span>
      ) : null}
      <div className="flex-1" />
      <Button variant="ghost" size="sm" onClick={clear}>
        {translate('buildWeb.take.clear', 'Clear')}
      </Button>
      {reason ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0}>{takeButton}</span>
          </TooltipTrigger>
          <TooltipContent>{reason}</TooltipContent>
        </Tooltip>
      ) : (
        takeButton
      )}
    </div>
  )
}
