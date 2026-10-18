import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { formatUiRelativeTimeFromDate } from '@/i18n/relative-time-format'
import { translate } from '@/i18n/i18n'
import type { BuildWebIssueDetail } from '../../../../../shared/build-web-types'
import type { BuildWebRun, BuildWebTestingStatus } from '../../../../../shared/build-web-run-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'
import { BuildWebListState } from '../BuildWebListState'
import { BuildWebToneChip } from '../BuildWebToneChip'
import { loginOf } from '../build-web-labels'
import { IssueNewBuild } from './build/IssueNewBuild'
import { IssueRunProgress } from './build/IssueRunProgress'

const SETTLED = new Set(['success', 'failed', 'partial', 'pending'])

/**
 * The task's «Build» tab, after build-web's IssueBuilds. A task has one run: without it the tab
 * looks for images already built after the task's last commit, then offers the form that makes
 * the run; with it, the run's own build screen.
 */
export function IssueBuildTab({
  target,
  detail,
  run,
  error,
  canWrite,
  testing,
  onChanged
}: {
  target: RuntimeClientTarget
  detail: BuildWebIssueDetail
  run: BuildWebRun | null | undefined
  error: string | null
  canWrite: boolean
  /** Where the first build is headed, chosen in Properties before the task has a run. */
  testing: BuildWebTestingStatus
  /** Read the task's run again — it was made, or its status moved. */
  onChanged: () => void
}): React.JSX.Element {
  const [adopt, setAdopt] = useState<'busy' | 'none' | null>(null)
  const adoptedFor = useRef<string | null>(null)

  // Once per task without a run: the console makes one only when something is already built.
  useEffect(() => {
    if (run !== null || error || !canWrite || adoptedFor.current === detail.id) {
      return
    }
    adoptedFor.current = detail.id
    let alive = true
    setAdopt('busy')
    callBuildWeb(target, 'adoptBuilt', { id: detail.id, testingStatus: testing })
      .then((result) => {
        if (result.ok && result.value.run) {
          onChanged()
        }
        if (alive) {
          setAdopt(
            result.ok && !result.value.run && result.value.reason === 'none built' ? 'none' : null
          )
        }
      })
      .catch(() => alive && setAdopt(null))
    return () => {
      alive = false
    }
  }, [canWrite, detail.id, error, onChanged, run, target, testing])

  if (error) {
    return <BuildWebListState kind="error" error={error} onRetry={onChanged} />
  }
  if (run === undefined) {
    return (
      <BuildWebListState
        kind="loading"
        loadingLabel={translate('buildWeb.state.loadingCard', 'Loading…')}
      />
    )
  }
  if (run === null) {
    if (!canWrite) {
      return (
        <p className="text-sm text-muted-foreground">
          {translate(
            'buildWeb.build.noRight',
            'The task has no build yet, and you have no right to build.'
          )}
        </p>
      )
    }
    return (
      <div className="flex flex-col gap-3">
        {adopt ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            {adopt === 'busy' ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {adopt === 'busy'
              ? translate(
                  'buildWeb.build.adopting',
                  'Looking for images already built after the task’s last commit…'
                )
              : translate(
                  'buildWeb.build.noneBuilt',
                  'No images were built after the task’s last commit.'
                )}
          </p>
        ) : null}
        <IssueNewBuild
          target={target}
          issue={{ id: detail.id, key: detail.key, branch: detail.branches[0] ?? 'master' }}
          testing={testing}
          onStarted={onChanged}
        />
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">{translate('buildWeb.card.build', 'Build')}</h2>
        <BuildWebToneChip label={run.branch} tone={null} mono />
        <BuildWebToneChip
          label={
            run.dist_type === 'both'
              ? translate('buildWeb.build.bothDists', 'rhel + redos')
              : run.dist_type
          }
          tone={null}
        />
        <span className="text-xs text-muted-foreground">
          {loginOf(run.user)} · {formatUiRelativeTimeFromDate(run.created_at)}
        </span>
      </div>
      <IssueRunProgress
        key={run.id}
        target={target}
        run={run}
        canWrite={canWrite}
        onStatus={(status) => {
          if (SETTLED.has(status)) {
            onChanged()
          }
        }}
      />
    </div>
  )
}
