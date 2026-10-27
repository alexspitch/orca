import { useCallback, useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import type { BuildWebRun } from '../../../../../../src/shared/build-web-run-types'
import type {
  BuildWebJob,
  BuildWebStand,
  BuildWebUiAccount
} from '../../../../../../src/shared/build-web-task-types'
import { useBuildWebScreen } from '../../../build-web-screen-context'
import { GuideButton } from './GuideButton'
import { GuideJobPanel } from './GuideJobPanel'
import { GuideSelectField } from './GuideSelectField'
import { guideStyles } from './guide-tab-styles'
import { messageOf } from './guide-failure'

const NONE = '__none__'

function passwordProblem(password: BuildWebUiAccount['password']): string | null {
  switch (password) {
    case 'set':
      return null
    case 'missing':
      return 'no password set'
    case 'broken':
      return 'the password does not decrypt'
  }
}

const upper = (products: string[]) => products.map((p) => p.toUpperCase()).join(', ')

/**
 * The guide's screenshots, after build-web's ShotTarget and its «Скриншоты» card: the stand and
 * the account they are taken as (kept on the run), and the job that takes them.
 */
export function GuideShotsCard({
  run,
  hasGuide,
  disabled,
  onRun,
  beforeShoot,
  onShotsTaken,
  onError
}: {
  run: BuildWebRun
  hasGuide: boolean
  disabled: boolean
  onRun: (run: BuildWebRun) => void
  /** Store unsaved edits first: the console takes the frame list off the stored guide. */
  beforeShoot: () => Promise<boolean>
  /** A job ended: the frames are new, read them again. */
  onShotsTaken: () => void
  onError: (message: string | null) => void
}) {
  const { call } = useBuildWebScreen()
  const [stands, setStands] = useState<BuildWebStand[]>([])
  const [accounts, setAccounts] = useState<BuildWebUiAccount[]>([])
  const [job, setJob] = useState<BuildWebJob | null>(null)
  const [showLog, setShowLog] = useState(false)
  const [shooting, setShooting] = useState(false)
  const running = job?.status === 'queued' || job?.status === 'running'

  useEffect(() => {
    void Promise.all([call('listStands'), call('listUiAccounts')]).then(
      ([s, a]) => {
        setStands(s.filter((x) => x.enabled))
        setAccounts(a)
      },
      (failure) => onError(messageOf(failure))
    )
  }, [call, onError])

  // The run's job, found on the console: it outlives the screen that started it.
  useEffect(() => {
    let alive = true
    void call('shotsJob', { runId: run.id }).then(
      (found) => {
        if (!alive || !found) {
          return
        }
        setJob(found)
        if (found.status === 'queued' || found.status === 'running') {
          setShowLog(true)
        } else {
          onShotsTaken()
        }
      },
      () => {}
    )
    return () => {
      alive = false
    }
  }, [run.id, call])

  const save = useCallback(
    async (patch: { standId?: string | null; accountId?: string | null }) => {
      onError(null)
      const result = await call('setGuideTarget', { runId: run.id, ...patch }).catch((failure) => ({
        ok: false as const,
        error: messageOf(failure)
      }))
      if (result.ok && result.value) {
        onRun(result.value)
      } else if (!result.ok) {
        onError(result.error)
      }
    },
    [call, onError, onRun, run.id]
  )

  // A run with no stand chosen takes the one its images resolve to, when there is exactly one.
  useEffect(() => {
    if (run.shot_stand_id) {
      return
    }
    let alive = true
    void call('resolveStand', { runId: run.id }).then(
      (standId) => {
        if (alive && standId) {
          void save({ standId })
        }
      },
      () => {}
    )
    return () => {
      alive = false
    }
  }, [run.id, run.shot_stand_id])

  const shoot = async () => {
    onError(null)
    setShooting(true)
    try {
      if (!(await beforeShoot())) {
        return
      }
      const result = await call('startGuideShots', { runId: run.id })
      if (result.ok && result.value) {
        setJob(result.value)
        setShowLog(true)
      } else if (!result.ok) {
        onError(result.error)
      }
    } catch (failure) {
      onError(messageOf(failure))
    } finally {
      setShooting(false)
    }
  }

  const chosen = stands.find((s) => s.id === run.shot_stand_id)
  const noUrl = Boolean(chosen && chosen.products.length === 0)
  const standOptions = [
    { value: NONE, label: '— not chosen —' },
    ...stands.map((s) => ({
      value: s.id,
      label: s.name,
      subtitle: s.products.length ? upper(s.products) : 'no UI address'
    })),
    ...(run.shot_stand_id && !chosen
      ? [{ value: run.shot_stand_id, label: run.shot_stand_id }]
      : [])
  ]
  const accountOptions = [
    { value: NONE, label: '— not chosen —' },
    ...accounts.map((a) => {
      const problem = passwordProblem(a.password)
      return {
        value: a.id,
        label: `${a.description} · ${a.email}`,
        subtitle: problem ?? undefined,
        disabled: Boolean(problem)
      }
    })
  ]
  return (
    <View style={guideStyles.card}>
      <Text style={guideStyles.heading}>Screenshots</Text>
      <GuideSelectField
        label="Stand for screenshots"
        value={run.shot_stand_id ?? NONE}
        options={standOptions}
        invalid={noUrl}
        hintDanger={noUrl}
        hint={
          noUrl
            ? 'the stand has no UI address — add them on the stand’s card'
            : chosen
              ? `frames are taken off this stand’s UI: ${upper(chosen.products)}`
              : 'UI addresses come from the chosen stand’s card'
        }
        onChange={(v) => void save({ standId: v === NONE ? null : v })}
      />
      <GuideSelectField
        label="UI account"
        value={run.shot_account_id ?? NONE}
        options={accountOptions}
        hint="the console signs in itself — the password never reaches the model"
        onChange={(v) => void save({ accountId: v === NONE ? null : v })}
      />
      <View style={guideStyles.row}>
        <Text style={[guideStyles.meta, { flex: 1 }]}>
          {job
            ? `shooting: ${job.status}${job.error ? ` — ${job.error}` : ''}`
            : 'no screenshots taken yet'}
        </Text>
        {job && !showLog && !running ? (
          <GuideButton compact variant="ghost" label="log" onPress={() => setShowLog(true)} />
        ) : null}
      </View>
      <GuideButton
        label={running ? 'Shooting…' : shooting ? 'Starting…' : 'Take screenshots'}
        busy={shooting || running}
        disabled={disabled || shooting || running || !hasGuide}
        onPress={() => void shoot()}
      />
      {job && (showLog || running) ? (
        <GuideJobPanel jobId={job.id} label="screenshots" onJob={setJob} onDone={onShotsTaken} />
      ) : null}
    </View>
  )
}
