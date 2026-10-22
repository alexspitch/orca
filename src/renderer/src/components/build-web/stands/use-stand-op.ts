import { useState } from 'react'
import { useConfirmationDialog } from '@/components/confirmation-dialog-context'
import { translate } from '@/i18n/i18n'
import type {
  BuildWebStandGroup,
  BuildWebStandOpKind
} from '../../../../../shared/build-web-stand-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'
import { useStandGroups } from './stand-groups-store'

const message = (failure: unknown) => (failure instanceof Error ? failure.message : String(failure))

export type StandOpState = {
  /** An operation of the stand is queued or running, here or started elsewhere. */
  running: boolean
  /** Nothing in the way: an enabled card, nothing starting or running. */
  canOperate: boolean
  error: string | null
  /** Asks first; true once the console took the operation, which then shows as the stand's job. */
  run: (kind: BuildWebStandOpKind, service?: string) => Promise<boolean>
}

/** `up -d` or `restart` of a stand, asked first, as a job of the stand: under its lock, in its history. */
export function useStandOp(target: RuntimeClientTarget, group: BuildWebStandGroup): StandOpState {
  const job = useStandGroups((s) => s.jobs[group.key] ?? null)
  const setJob = useStandGroups((s) => s.setJob)
  const confirm = useConfirmationDialog()
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const running = job?.status === 'queued' || job?.status === 'running'

  const place = `${group.sshHost}:${group.dir}`
  const lockNote = group.lock
    ? ` ${translate('buildWeb.stands.ops.lockNote', 'The stand is held by {{holder}}; the operation waits for it.', { holder: group.lock.heldBy })}`
    : ''
  const run = async (kind: BuildWebStandOpKind, service?: string): Promise<boolean> => {
    if (!group.opsCardId) {
      return false
    }
    const ok = await confirm(
      kind === 'up'
        ? {
            title: translate('buildWeb.stands.ops.upTitle', 'Bring {{stand}} up?', {
              stand: group.name
            }),
            description:
              translate(
                'buildWeb.stands.ops.upDescription',
                'docker compose up -d in {{place}}: every service is created or recreated as its compose files say.',
                { place }
              ) + lockNote,
            confirmLabel: translate('buildWeb.stands.ops.upConfirm', 'Run up -d')
          }
        : {
            title: translate('buildWeb.stands.ops.restartTitle', 'Restart {{service}}?', {
              service: service ?? ''
            }),
            description:
              translate(
                'buildWeb.stands.ops.restartDescription',
                'docker compose restart {{service}} in {{place}}.',
                { service: service ?? '', place }
              ) + lockNote,
            confirmLabel: translate('buildWeb.stands.ops.restartConfirm', 'Restart')
          }
    )
    if (!ok) {
      return false
    }
    setStarting(true)
    setError(null)
    try {
      const result = await callBuildWeb(target, 'standOp', {
        standId: group.opsCardId,
        kind,
        ...(service ? { services: [service] } : {})
      })
      if (result.ok) {
        setJob(group.key, result.value)
        return true
      }
      setError(result.error)
      return false
    } catch (failure) {
      setError(message(failure))
      return false
    } finally {
      setStarting(false)
    }
  }
  return {
    running,
    canOperate: group.opsCardId !== null && !starting && !running,
    error,
    run
  }
}
