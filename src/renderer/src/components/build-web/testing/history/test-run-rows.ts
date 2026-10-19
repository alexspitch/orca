import type {
  BuildWebTestJobScope,
  BuildWebTestRun
} from '../../../../../../shared/build-web-test-history-types'
import { translate } from '@/i18n/i18n'
import type { TestRunKind } from '../testing-view-prefs'

// The run list of Test history, after build-web's job-title.ts and TestHistory: what a run is
// called, what it came to, and the day it belongs to.

/** A run of the build agent, against one a person (or the stand gate) started on the console. */
export const isNightlyRun = (r: Pick<BuildWebTestRun, 'exec_mode'>): boolean =>
  r.exec_mode === 'agent-nightly' || r.exec_mode === 'agent-recheck'

export function runsOfKind(runs: readonly BuildWebTestRun[], kind: TestRunKind): BuildWebTestRun[] {
  return kind === 'all' ? [...runs] : runs.filter((r) => (kind === 'nightly') === isNightlyRun(r))
}

export const TEST_FAMILIES = ['applications', 'packages', 'plugins', 'e2e', 'other'] as const
export type TestFamily = (typeof TEST_FAMILIES)[number]

/** The family of the repository a workspace belongs to, from its path. */
export function familyOf(workspace: string): TestFamily {
  const top = workspace.split('/')[0]
  return TEST_FAMILIES.find((f) => f === top && f !== 'other') ?? 'other'
}

/** The workspace's own name: `plugins/sa-plugin-wfm/backend` is `sa-plugin-wfm/backend`. */
export function shortWorkspace(workspace: string): string {
  const parts = workspace.split('/')
  if (parts[0] === 'plugins' && parts.length >= 3) {
    return `${parts[1]}/${parts.slice(2).join('/')}`
  }
  return parts.slice(1).join('/') || workspace
}

/**
 * The test's own name inside a runner's native id. pytest separates with every `::`; mocha and
 * jest only with the first, since the title is prose and may hold `::` of its own.
 */
export function testName(nativeId: string): string {
  const cut = nativeId.indexOf('::')
  if (cut === -1) {
    return nativeId
  }
  const tail = nativeId.slice(cut + 2)
  if (!nativeId.slice(0, cut).endsWith('.py')) {
    return tail || nativeId
  }
  return tail.split('::').at(-1) || nativeId
}

const baseName = (p: string): string => p.split('/').pop() || p

const andMore = (first: string, more: number): string =>
  translate('buildWeb.testHistory.andMore', '{{first}} and {{more}} more', { first, more })

/** What a job ran, and what that is a name of — the caller shows the second more quietly. */
function jobTitle(job: BuildWebTestJobScope): { title: string; scope: string | null } {
  const sel = job.selection
  if (sel.mode === 'tests' && sel.tests.length > 0) {
    return sel.tests.length === 1
      ? {
          title: testName(sel.tests[0]),
          scope: translate('buildWeb.testHistory.scopeTest', 'test')
        }
      : {
          title: andMore(testName(sel.tests[0]), sel.tests.length - 1),
          scope: translate('buildWeb.testHistory.scopeTests', 'tests')
        }
  }
  if (sel.mode === 'files' && sel.files.length > 0) {
    return sel.files.length === 1
      ? {
          title: baseName(sel.files[0]),
          scope: translate('buildWeb.testHistory.scopeFile', 'file')
        }
      : {
          title: andMore(baseName(sel.files[0]), sel.files.length - 1),
          scope: translate('buildWeb.testHistory.scopeFiles', 'files')
        }
  }
  if (sel.mode === 'phases' && sel.phases.length > 0) {
    return {
      title: sel.phases.join(' + '),
      scope: translate('buildWeb.testHistory.scopePhases', 'harness phases')
    }
  }
  if (sel.mode === 'tag' && sel.expr) {
    return { title: sel.expr, scope: translate('buildWeb.testHistory.scopeTag', 'by tag') }
  }
  if (sel.mode === 'shard' && sel.total) {
    return {
      title: translate('buildWeb.testHistory.shard', 'shard {{index}}/{{total}}', {
        index: sel.index ?? '?',
        total: sel.total
      }),
      scope: job.suite_variant
    }
  }
  // Null: the whole suite ran, so the workspace, not the suite's name, is what names it.
  return { title: job.suite_variant, scope: null }
}

const workspaceCount = (n: number): string =>
  translate('buildWeb.testHistory.workspaces', '{{count}} workspace(s)', { count: n })

/** What a run is called in a list: after what it ran, or the build agent's run. */
export function runTitle(r: Pick<BuildWebTestRun, 'id' | 'jobs' | 'exec_mode'>): {
  title: string
  sub: string
} {
  const jobs = r.jobs
  if (isNightlyRun(r)) {
    return {
      title:
        r.exec_mode === 'agent-nightly'
          ? translate('buildWeb.testHistory.nightly', 'Nightly run of master')
          : translate('buildWeb.testHistory.recheck', 'Recheck of the red'),
      sub: workspaceCount(new Set(jobs.map((j) => j.workspace)).size)
    }
  }
  if (jobs.length === 0) {
    return { title: r.id.slice(0, 8), sub: translate('buildWeb.testHistory.noJobs', 'no jobs') }
  }
  const first = jobTitle(jobs[0])
  const where = shortWorkspace(jobs[0].workspace)
  const lead = first.scope === null ? where : first.title
  if (jobs.length === 1) {
    const scope = first.scope ?? translate('buildWeb.testHistory.scopeSuite', 'whole suite')
    return { title: lead, sub: `${where} · ${scope}` }
  }
  const others = new Set(jobs.map((j) => shortWorkspace(j.workspace)))
  return {
    title: andMore(lead, jobs.length - 1),
    sub: others.size === 1 ? where : workspaceCount(others.size)
  }
}

/** What a run came to, in one line. */
export function summarize(r: Pick<BuildWebTestRun, 'totals'>): string {
  const t = r.totals
  const parts = [
    t.passed ? `${t.passed} passed` : null,
    t.failed ? `${t.failed} failed` : null,
    t.skipped ? `${t.skipped} skipped` : null
  ].filter((p) => p !== null)
  return parts.length > 0
    ? parts.join(' · ')
    : translate('buildWeb.testHistory.noResults', '{{count}} job(s), no results', {
        count: t.jobs
      })
}

/** Where a run ran: the branch, or the console's own checkout when it has none. */
export function runPlace(r: Pick<BuildWebTestRun, 'branch' | 'exec_mode'>): string {
  if (!r.branch) {
    return translate('buildWeb.testHistory.workingTree', 'working tree')
  }
  return r.exec_mode === 'working-tree'
    ? translate('buildWeb.testHistory.inWorkingTree', '{{branch}} (in the working tree)', {
        branch: r.branch
      })
    : r.branch
}

/** The commit a run ran, short, with `+` for uncommitted edits. */
export const runCommit = (r: Pick<BuildWebTestRun, 'commit_sha' | 'dirty'>): string =>
  `${(r.commit_sha ?? '').slice(0, 7)}${r.dirty ? '+' : ''}`

const startOfDay = (d: Date): number =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

/** The day a run belongs to in the list: Today, Yesterday, then the date. */
export function dayLabel(iso: string, locale: string, now = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return '—'
  }
  const diff = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000)
  const sameYear = d.getFullYear() === now.getFullYear()
  const date = d.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' })
  })
  if (diff === 0) {
    return translate('buildWeb.testHistory.today', 'Today, {{date}}', { date })
  }
  if (diff === 1) {
    return translate('buildWeb.testHistory.yesterday', 'Yesterday, {{date}}', { date })
  }
  return date
}

/** The runs read by day; they come newest first, so a day is a stretch of equal labels. */
export function runDays(
  runs: readonly BuildWebTestRun[],
  locale: string,
  now = new Date()
): { label: string; runs: BuildWebTestRun[] }[] {
  const out: { label: string; runs: BuildWebTestRun[] }[] = []
  for (const r of runs) {
    const label = dayLabel(r.created_at, locale, now)
    const last = out.at(-1)
    if (last?.label === label) {
      last.runs.push(r)
    } else {
      out.push({ label, runs: [r] })
    }
  }
  return out
}
