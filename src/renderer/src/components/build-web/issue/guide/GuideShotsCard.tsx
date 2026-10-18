import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import type { BuildWebRun } from '../../../../../../shared/build-web-run-types'
import type {
  BuildWebJob,
  BuildWebStand,
  BuildWebUiAccount
} from '../../../../../../shared/build-web-task-types'
import type { RuntimeClientTarget } from '../../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../../build-web-client'
import { GuideJobPanel } from './GuideJobPanel'

const NONE = '__none__'

function passwordProblem(password: BuildWebUiAccount['password']): string | null {
  switch (password) {
    case 'set':
      return null
    case 'missing':
      return translate('buildWeb.guide.noPassword', 'no password set')
    case 'broken':
      return translate('buildWeb.guide.brokenPassword', 'the password does not decrypt')
  }
}

const upper = (products: string[]) => products.map((p) => p.toUpperCase()).join(', ')

/**
 * The guide's screenshots, after build-web's ShotTarget and its «Скриншоты» card: the stand and the
 * account they are taken as (kept on the run), and the job that takes them.
 */
export function GuideShotsCard({
  target,
  run,
  hasGuide,
  disabled,
  onRun,
  beforeShoot,
  onShotsTaken,
  onError
}: {
  target: RuntimeClientTarget
  run: BuildWebRun
  hasGuide: boolean
  disabled: boolean
  onRun: (run: BuildWebRun) => void
  /** Store unsaved edits first: the console takes the frame list off the stored guide. */
  beforeShoot: () => Promise<boolean>
  /** A job ended: the frames are new, read them again. */
  onShotsTaken: () => void
  onError: (message: string | null) => void
}): React.JSX.Element {
  const [stands, setStands] = useState<BuildWebStand[]>([])
  const [accounts, setAccounts] = useState<BuildWebUiAccount[]>([])
  const [job, setJob] = useState<BuildWebJob | null>(null)
  const [showLog, setShowLog] = useState(false)
  const [shooting, setShooting] = useState(false)
  const running = job?.status === 'queued' || job?.status === 'running'

  useEffect(() => {
    void Promise.all([
      callBuildWeb(target, 'listStands'),
      callBuildWeb(target, 'listUiAccounts')
    ]).then(
      ([s, a]) => {
        setStands(s.filter((x) => x.enabled))
        setAccounts(a)
      },
      (failure) => onError(failure instanceof Error ? failure.message : String(failure))
    )
  }, [onError, target])

  // The run's job, found on the console: it outlives the tab that started it.
  useEffect(() => {
    let alive = true
    void callBuildWeb(target, 'shotsJob', { runId: run.id }).then(
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per run.
  }, [run.id, target])

  const save = async (patch: { standId?: string | null; accountId?: string | null }) => {
    onError(null)
    const result = await callBuildWeb(target, 'setGuideTarget', { runId: run.id, ...patch }).catch(
      (failure) => ({
        ok: false as const,
        error: failure instanceof Error ? failure.message : String(failure)
      })
    )
    if (result.ok && result.value) {
      onRun(result.value)
    } else if (!result.ok) {
      onError(result.error)
    }
  }

  // A run with no stand chosen takes the one its images resolve to, when there is exactly one.
  useEffect(() => {
    if (run.shot_stand_id) {
      return
    }
    let alive = true
    void callBuildWeb(target, 'resolveStand', { runId: run.id }).then(
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-asked only when the choice is cleared.
  }, [run.id, run.shot_stand_id])

  const shoot = async () => {
    onError(null)
    setShooting(true)
    try {
      if (!(await beforeShoot())) {
        return
      }
      const result = await callBuildWeb(target, 'startGuideShots', { runId: run.id })
      if (result.ok && result.value) {
        setJob(result.value)
        setShowLog(true)
      } else if (!result.ok) {
        onError(result.error)
      }
    } catch (failure) {
      onError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setShooting(false)
    }
  }

  const chosen = stands.find((s) => s.id === run.shot_stand_id)
  const noUrl = Boolean(chosen && chosen.products.length === 0)
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-sm">
      <h3 className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
        {translate('buildWeb.guide.shots', 'Screenshots')}
      </h3>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">
          {translate('buildWeb.guide.shotStand', 'Stand for screenshots')}
        </span>
        <Select
          value={run.shot_stand_id ?? NONE}
          onValueChange={(v) => void save({ standId: v === NONE ? null : v })}
        >
          <SelectTrigger size="sm" className="w-full" aria-invalid={noUrl}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>
              {translate('buildWeb.guide.notChosen', '— not chosen —')}
            </SelectItem>
            {stands.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
                {s.products.length
                  ? ` · ${upper(s.products)}`
                  : ` · ${translate('buildWeb.guide.noUiUrl', 'no UI address')}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className={noUrl ? 'text-2xs text-destructive' : 'text-2xs text-muted-foreground'}>
          {noUrl
            ? translate(
                'buildWeb.guide.standNoUrl',
                'the stand has no UI address — add them on the stand’s card'
              )
            : chosen
              ? translate(
                  'buildWeb.guide.standUrls',
                  'frames are taken off this stand’s UI: {{products}}',
                  {
                    products: upper(chosen.products)
                  }
                )
              : translate(
                  'buildWeb.guide.standHint',
                  'UI addresses come from the chosen stand’s card'
                )}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">
          {translate('buildWeb.guide.account', 'UI account')}
        </span>
        <Select
          value={run.shot_account_id ?? NONE}
          onValueChange={(v) => void save({ accountId: v === NONE ? null : v })}
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>
              {translate('buildWeb.guide.notChosen', '— not chosen —')}
            </SelectItem>
            {accounts.map((a) => {
              const problem = passwordProblem(a.password)
              return (
                <SelectItem key={a.id} value={a.id} disabled={Boolean(problem)}>
                  {a.description} · {a.email}
                  {problem ? <span className="text-destructive"> — {problem}</span> : null}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
        <span className="text-2xs text-muted-foreground">
          {translate(
            'buildWeb.guide.accountHint',
            'the console signs in itself — the password never reaches the model'
          )}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="flex-1 text-xs text-muted-foreground">
          {job
            ? translate('buildWeb.guide.shotsState', 'shooting: {{status}}', {
                status: job.status
              }) + (job.error ? ` — ${job.error}` : '')
            : translate('buildWeb.guide.shotsNever', 'no screenshots taken yet')}
        </span>
        {job && !showLog && !running ? (
          <Button variant="ghost" size="xs" onClick={() => setShowLog(true)}>
            {translate('buildWeb.guide.log', 'log')}
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || shooting || running || !hasGuide}
          onClick={() => void shoot()}
        >
          {shooting || running ? <Loader2 className="animate-spin" /> : null}
          {running
            ? translate('buildWeb.guide.shooting', 'Shooting…')
            : shooting
              ? translate('buildWeb.guide.starting', 'Starting…')
              : translate('buildWeb.guide.shoot', 'Take screenshots')}
        </Button>
      </div>
      {job && (showLog || running) ? (
        <GuideJobPanel target={target} jobId={job.id} onJob={setJob} onDone={onShotsTaken} />
      ) : null}
    </section>
  )
}
