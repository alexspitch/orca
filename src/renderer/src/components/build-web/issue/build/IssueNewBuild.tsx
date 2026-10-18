import { useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCw, Search, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import type {
  BuildWebDetect,
  BuildWebTestingStatus
} from '../../../../../../shared/build-web-run-types'
import type { RuntimeClientTarget } from '../../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../../build-web-client'
import { ImagePicker } from './ImagePicker'
import { NewBuildRows, ReadOnlyField, Step, rowKey, testingNote, type Row } from './NewBuildParts'

// A task's first build, after build-web's IssueNewBuild: the release branch is the task's, the
// console finds the images its commits touch, more can be added, and «Create» makes the run.

export function IssueNewBuild({
  target,
  issue,
  testing,
  onStarted
}: {
  target: RuntimeClientTarget
  issue: { id: string; key: string; branch: string }
  testing: BuildWebTestingStatus
  onStarted: () => void
}): React.JSX.Element {
  const branch = issue.branch
  const [detect, setDetect] = useState<BuildWebDetect | null>(null)
  const [off, setOff] = useState<ReadonlySet<string>>(new Set())
  const [manual, setManual] = useState<{ image: string; branch: string }[]>([])
  const [allImages, setAllImages] = useState<string[]>([])
  const [branches, setBranches] = useState<string[]>([])
  const [choice, setChoice] = useState<string | null>(null)
  const [addBranch, setAddBranch] = useState(branch)
  const [busy, setBusy] = useState<'fetch' | 'detect' | 'start' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void callBuildWeb(target, 'imageNames').then(setAllImages, () => setAllImages([]))
    void callBuildWeb(target, 'branches').then(
      (list) => setBranches(list.map((b) => b.name)),
      () => setBranches([])
    )
  }, [target])

  const rows: Row[] = useMemo(() => {
    if (!detect) {
      return []
    }
    return [
      ...detect.images.map((image) => ({
        image,
        branch,
        why:
          (detect.image_sources[image] ?? []).join(', ') ||
          translate('buildWeb.newBuild.whyChanges', 'the task’s changes'),
        origin: 'found' as const
      })),
      ...detect.suggested_images.map((image) => ({
        image,
        branch,
        why:
          (detect.suggested_image_sources[image] ?? []).join(', ') ||
          translate('buildWeb.newBuild.whyShared', 'depends on changed shared code'),
        origin: 'suggested' as const
      })),
      ...manual.map((m) => ({
        ...m,
        why: translate('buildWeb.newBuild.whyManual', 'added by hand'),
        origin: 'manual' as const
      }))
    ]
  }, [branch, detect, manual])
  const chosen = rows.filter((r) => !off.has(rowKey(r)))
  const extras = allImages.filter(
    (i) => !rows.some((r) => rowKey(r) === rowKey({ image: i, branch: addBranch }))
  )
  const branchOptions = branches.includes(branch) ? branches : [branch, ...branches]
  const messageOf = (failure: unknown) =>
    failure instanceof Error ? failure.message : String(failure)

  const fetchBranches = async () => {
    setBusy('fetch')
    const result = await callBuildWeb(target, 'fetchRepo').catch((failure) => ({
      ok: false as const,
      error: messageOf(failure)
    }))
    if (result.ok) {
      setBranches(result.value.map((b) => b.name))
    } else {
      setError(result.error)
    }
    setBusy(null)
  }

  const runDetect = async () => {
    setError(null)
    setBusy('detect')
    try {
      const found = await callBuildWeb(target, 'detectImages', { branch, ticket: issue.key })
      setDetect(found)
      // Suggested images are a guess, so they start unticked.
      setOff(new Set(found.suggested_images.map((image) => rowKey({ image, branch }))))
      setManual([])
    } catch (failure) {
      setError(messageOf(failure))
      setDetect(null)
    } finally {
      setBusy(null)
    }
  }

  const create = async () => {
    setError(null)
    setBusy('start')
    try {
      const result = await callBuildWeb(target, 'createIssueRun', {
        issueId: issue.id,
        ticket: issue.key,
        branch,
        images: chosen.filter((r) => r.branch === branch).map((r) => r.image),
        // Every build covers both distributions, so an image on another branch is two combos.
        extra: chosen
          .filter((r) => r.branch !== branch)
          .flatMap((r) =>
            ['rhel', 'redos'].map((dist) => ({ image: r.image, dist, branch: r.branch }))
          ),
        testingStatus: testing,
        detected: detect?.raw ?? null
      })
      if (result.ok) {
        onStarted()
      } else {
        setError(result.error)
      }
    } catch (failure) {
      setError(messageOf(failure))
    } finally {
      setBusy(null)
    }
  }

  const detectLabel = detect
    ? translate('buildWeb.newBuild.detectAgain', 'Find again')
    : translate('buildWeb.newBuild.detect', 'Find images')
  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <Step n={1} on title={translate('buildWeb.newBuild.from', 'Where to build from')} />
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-[2]">
            <ReadOnlyField
              label={
                <>
                  {translate('buildWeb.newBuild.branch', 'Branch')}{' '}
                  <span className="text-primary">
                    · {translate('buildWeb.newBuild.fromRelease', 'from the task’s release')}
                  </span>
                </>
              }
              value={branch}
            />
          </div>
          <div className="w-36">
            <ReadOnlyField label={translate('buildWeb.newBuild.task', 'Task')} value={issue.key} />
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy === 'fetch'}
            onClick={() => void fetchBranches()}
          >
            {busy === 'fetch' ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            {translate('buildWeb.newBuild.fetch', 'Fetch')}
          </Button>
          <Button
            size="sm"
            disabled={!branch || busy === 'detect'}
            onClick={() => void runDetect()}
          >
            {busy === 'detect' ? <Loader2 className="animate-spin" /> : <Search />}
            {detectLabel}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{testingNote(testing)}</p>
      </section>
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <Step n={2} on={Boolean(detect)} title={translate('buildWeb.newBuild.images', 'Images')}>
          {detect ? (
            <span className="text-xs text-muted-foreground">
              {translate('buildWeb.newBuild.commits', '{{key}} · {{n}} commit(s) in {{branch}}', {
                key: detect.ticket ?? issue.key,
                n: String(detect.commit_count),
                branch: detect.branch
              })}
            </span>
          ) : null}
        </Step>
        {detect ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <p className="flex-1 text-xs text-muted-foreground">
                {chosen.length
                  ? translate(
                      'buildWeb.newBuild.chosen',
                      'Images chosen: {{n}} · rhel and redos — {{builds}} builds. Builds do not start by themselves: they are started on the next step.',
                      { n: String(chosen.length), builds: String(chosen.length * 2) }
                    )
                  : translate('buildWeb.newBuild.pick', 'Tick images or add one by hand.')}
              </p>
              <Button
                size="sm"
                disabled={!chosen.length || busy === 'start'}
                onClick={() => void create()}
              >
                {busy === 'start'
                  ? translate('buildWeb.newBuild.creating', 'Creating…')
                  : translate('buildWeb.newBuild.create', 'Create build')}
              </Button>
            </div>
            <NewBuildRows
              rows={rows}
              off={off}
              branch={branch}
              onToggle={(key, on) =>
                setOff((current) => {
                  const next = new Set(current)
                  if (on) {
                    next.delete(key)
                  } else {
                    next.add(key)
                  }
                  return next
                })
              }
            />
            {detect.plugins_changed.length > 0 ? (
              <p className="flex items-start gap-2 rounded-md bg-chip-tone-amber/15 px-3 py-2 text-xs text-chip-tone-amber">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                {translate(
                  'buildWeb.newBuild.plugins',
                  'Plugin changes pull in the sa-backend image: {{list}}.',
                  {
                    list: detect.plugins_changed.join(', ')
                  }
                )}
              </p>
            ) : null}
            {detect.ignored_shared.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {translate('buildWeb.newBuild.shared', 'Shared code changed: {{list}}.', {
                  list: detect.ignored_shared.join(', ')
                })}
              </p>
            ) : null}
            <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
              <div className="flex min-w-64 flex-1 flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">
                  {translate('buildWeb.newBuild.addAny', 'Add any image')}
                </span>
                <ImagePicker images={extras} value={choice} onChange={setChoice} />
              </div>
              <Select
                value={addBranch}
                onValueChange={(next) => {
                  setAddBranch(next)
                  setChoice(null)
                }}
              >
                <SelectTrigger size="sm" className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {branchOptions.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                disabled={!choice}
                onClick={() => {
                  if (choice) {
                    setManual((m) => [...m, { image: choice, branch: addBranch }])
                    setChoice(null)
                  }
                }}
              >
                {translate('buildWeb.newBuild.add', 'Add')}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex min-h-56 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border p-6 text-center">
            <p className="text-sm font-semibold">
              {translate('buildWeb.newBuild.notYet', 'No images found yet')}
            </p>
            <p className="max-w-md text-xs text-muted-foreground">
              {translate(
                'buildWeb.newBuild.explain',
                'The console compares the task’s commits with the branch and offers the images they touch. Any other image can be added by hand.'
              )}
            </p>
            <Button
              size="sm"
              disabled={!branch || busy === 'detect'}
              onClick={() => void runDetect()}
            >
              {translate('buildWeb.newBuild.detect', 'Find images')}
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}
