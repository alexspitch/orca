import { useEffect } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type { BuildWebJob } from '../../../../../shared/build-web-task-types'
import type { BuildWebStandGroup } from '../../../../../shared/build-web-stand-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'
import { useStandGroups } from './stand-groups-store'

const POLL_MS = 4000

export const isJobActive = (job: BuildWebJob | null): boolean =>
  job?.status === 'queued' || job?.status === 'running'

/**
 * A stand's operation for its row in the stands table: one started elsewhere is picked up, and a
 * going one is followed to its end, which reads the monitoring again.
 */
export function useStandJobFollow(
  target: RuntimeClientTarget,
  group: BuildWebStandGroup,
  enabled: boolean
): BuildWebJob | null {
  const job = useStandGroups((s) => s.jobs[group.key] ?? null)
  const setJob = useStandGroups((s) => s.setJob)
  const cardIds = group.cards.map((c) => c.id).join(',')

  useEffect(() => {
    if (!enabled || !cardIds) {
      return
    }
    let alive = true
    void callBuildWeb(target, 'standJobs', { standIds: cardIds.split(',') })
      .then((result) => {
        const latest = result.ok ? (result.value[0] ?? null) : null
        // Why only a going one: a finished job of last week is not news on the table.
        if (alive && isJobActive(latest) && !useStandGroups.getState().jobs[group.key]) {
          setJob(group.key, latest)
        }
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [cardIds, enabled, group.key, setJob, target])

  const followed = enabled && job && isJobActive(job) ? job.id : null
  useEffect(() => {
    if (!followed) {
      return
    }
    let alive = true
    const read = async () => {
      const view = await callBuildWeb(target, 'getJob', { jobId: followed }).catch(() => null)
      if (!alive || !view) {
        return
      }
      setJob(group.key, view.job)
      if (isJobActive(view.job)) {
        return
      }
      if (view.job.status === 'success') {
        toast.success(
          translate('buildWeb.stands.ops.done', '{{stand}}: the operation finished', {
            stand: group.name
          })
        )
      } else {
        toast.error(
          translate('buildWeb.stands.ops.failed', '{{stand}}: the operation ended {{status}}', {
            stand: group.name,
            status: view.job.status
          }),
          view.job.error ? { description: view.job.error } : undefined
        )
      }
      useStandGroups.getState().refreshHealth()
    }
    const timer = window.setInterval(() => void read(), POLL_MS)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [followed, group.key, group.name, setJob, target])

  return job
}
