import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  BuildWebDetect,
  BuildWebIssueBuildBranch,
  BuildWebTestingStatus
} from '../../../../../../src/shared/build-web-run-types'
import { repoField, type BuildWebRepo } from '../../../../../../src/shared/build-web-repos'
import { messageOf, useBuildTabCall } from './build-tab-call'
import { rowKey, type Row } from './NewBuildParts'

export type NewBuildIssue = { id: string; key: string; branch: string; repo: BuildWebRepo }

/**
 * A task's first build, after build-web's IssueNewBuild: the release branch is the task's, the
 * console finds the images its commits touch, more can be added, and «Create» makes the run.
 */
export function useNewBuild(
  issue: NewBuildIssue,
  testing: BuildWebTestingStatus,
  onStarted: () => void
) {
  const { call } = useBuildTabCall()
  const releaseBranch = issue.branch
  // Why by hand too: a fix may need building from a branch other than its release's.
  const [picked, setPicked] = useState<string | null>(null)
  const branch = picked ?? releaseBranch
  const [detect, setDetect] = useState<BuildWebDetect | null>(null)
  const [off, setOff] = useState<ReadonlySet<string>>(new Set())
  const [manual, setManual] = useState<{ image: string; branch: string }[]>([])
  const [allImages, setAllImages] = useState<string[]>([])
  const [branches, setBranches] = useState<string[]>([])
  const [choice, setChoice] = useState<string | null>(null)
  const [addBranch, setAddBranch] = useState(branch)
  const [busy, setBusy] = useState<'fetch' | 'detect' | 'start' | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Why null: a console that cannot list them keeps adding every newer branch, as before.
  const [releaseBranches, setReleaseBranches] = useState<BuildWebIssueBuildBranch[] | null>(null)
  const [offBranches, setOffBranches] = useState<ReadonlySet<string>>(new Set())
  const [askingVersions, setAskingVersions] = useState(false)

  // Why the repository: a `cp` task's images and branches are chat-platform's, not the monorepo's.
  const repo = repoField(issue.repo)
  const repoKey = issue.repo
  useEffect(() => {
    const args = repoField(repoKey)
    void call('imageNames', args).then(setAllImages, () => setAllImages([]))
    void call('branches', args).then(
      (list) => setBranches(list.map((b) => b.name)),
      () => setBranches([])
    )
  }, [call, repoKey])

  const issueId = issue.id
  useEffect(() => {
    void call('issueBuildBranches', { id: issueId }).then(
      (list) => {
        setReleaseBranches(list)
        setOffBranches(new Set(list?.filter((b) => b.excluded).map((b) => b.branch)))
      },
      () => setReleaseBranches(null)
    )
  }, [call, issueId])

  const rows: Row[] = useMemo(() => {
    if (!detect) {
      return []
    }
    return [
      ...detect.images.map((image) => ({
        image,
        branch,
        why: (detect.image_sources[image] ?? []).join(', ') || 'the task’s changes',
        origin: 'found' as const
      })),
      ...detect.suggested_images.map((image) => ({
        image,
        branch,
        why:
          (detect.suggested_image_sources[image] ?? []).join(', ') ||
          'depends on changed shared code',
        origin: 'suggested' as const
      })),
      ...manual.map((m) => ({ ...m, why: 'added by hand', origin: 'manual' as const }))
    ]
  }, [branch, detect, manual])
  const chosen = rows.filter((r) => !off.has(rowKey(r)))
  const extras = allImages.filter(
    (i) => !rows.some((r) => rowKey(r) === rowKey({ image: i, branch: addBranch }))
  )
  const branchOptions = [...new Set([releaseBranch, branch, ...branches])]

  const fetchBranches = async () => {
    setBusy('fetch')
    const result = await call('fetchRepo', repo).catch((failure: unknown) => ({
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

  // Which detection is current: picking another branch makes an answer still in flight stale.
  const detectGeneration = useRef(0)
  const runDetect = async () => {
    const mine = ++detectGeneration.current
    setError(null)
    setBusy('detect')
    try {
      const found = await call('detectImages', { branch, ticket: issue.key, ...repo })
      if (mine !== detectGeneration.current) {
        return
      }
      setDetect(found)
      // Suggested images are a guess, so they start unticked.
      setOff(new Set(found.suggested_images.map((image) => rowKey({ image, branch }))))
      setManual([])
    } catch (failure) {
      if (mine === detectGeneration.current) {
        setError(messageOf(failure))
        setDetect(null)
      }
    } finally {
      if (mine === detectGeneration.current) {
        setBusy(null)
      }
    }
  }

  const create = async () => {
    setError(null)
    setBusy('start')
    try {
      const result = await call('createIssueRun', {
        issueId: issue.id,
        ticket: issue.key,
        branch,
        // Why the release branch: the console builds `images` there whatever branch is named.
        images: chosen.filter((r) => r.branch === releaseBranch).map((r) => r.image),
        // Every build covers both distributions, so an image on another branch is two combos.
        extra: chosen
          .filter((r) => r.branch !== releaseBranch)
          .flatMap((r) =>
            ['rhel', 'redos'].map((dist) => ({ image: r.image, dist, branch: r.branch }))
          ),
        testingStatus: testing,
        detected: detect?.raw ?? null,
        ...(releaseBranches
          ? {
              excludeBranches: releaseBranches
                .filter((b) => !b.primary && offBranches.has(b.branch))
                .map((b) => b.branch)
            }
          : {})
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

  return {
    releaseBranch,
    branch,
    pickBranch: (next: string) => {
      setPicked(next === releaseBranch ? null : next)
      // Why: what was found belongs to the branch it was found on, and so does a search still running.
      detectGeneration.current += 1
      setBusy((current) => (current === 'detect' ? null : current))
      setDetect(null)
      setManual([])
      setAddBranch(next)
    },
    detect,
    rows,
    off,
    toggle: (key: string, on: boolean) =>
      setOff((current) => {
        const next = new Set(current)
        if (on) {
          next.delete(key)
        } else {
          next.add(key)
        }
        return next
      }),
    chosen,
    extras,
    branchOptions,
    choice,
    setChoice,
    addBranch,
    pickAddBranch: (next: string) => {
      setAddBranch(next)
      setChoice(null)
    },
    addManual: () => {
      if (choice) {
        setManual((m) => [...m, { image: choice, branch: addBranch }])
        setChoice(null)
      }
    },
    busy,
    error,
    releaseBranches,
    offBranches,
    setOffBranches,
    askingVersions,
    setAskingVersions,
    fetchBranches,
    runDetect,
    create,
    requestCreate: () => {
      if (releaseBranches && releaseBranches.length > 1) {
        setAskingVersions(true)
      } else {
        void create()
      }
    }
  }
}
