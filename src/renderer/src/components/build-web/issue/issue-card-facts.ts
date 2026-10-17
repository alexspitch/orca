import type { BuildWebStatus } from '../../../../../shared/build-web-types'
import type { BuildWebRun } from '../../../../../shared/build-web-run-types'

// After build-web's cardFacts.ts: the card's one-step status move and the run's image tally.

export function nextStatus(status: BuildWebStatus, subtask: boolean): BuildWebStatus | null {
  if (status === 'done' || status === 'wontfix') {
    return null
  }
  if (status === 'inprogress') {
    return subtask ? 'done' : 'deploying'
  }
  if (status === 'deploying') {
    return 'testing'
  }
  // Built again by hand, when the causes were fixed outside its subtasks.
  if (status === 'build_failed') {
    return 'deploying'
  }
  if (status === 'testing' || status === 'testing_external') {
    return 'done'
  }
  return 'inprogress'
}

/** Images of a run: how many built and out of how many — an image counts once. */
export function imageTally(run: BuildWebRun): { ok: number; total: number } {
  const all = new Set(run.builds.map((b) => b.image))
  const ok = new Set(run.builds.filter((b) => b.status === 'SUCCESS').map((b) => b.image))
  return { ok: ok.size, total: all.size }
}

/** Whether the token owner may read runs (build or history) — the Build and Guide tabs. */
export const readsRuns = (perms: string[]) => perms.includes('build') || perms.includes('history')
/** Whether the owner may push and save guides — writes need `build`. */
export const writesRuns = (perms: string[]) => perms.includes('build')

const SHOT_RE = /!\[([^\]]*)\]\(shot:([A-Za-z0-9._-]{1,120})\)/g

/** The screenshot slugs a guide refers to as `![…](shot:slug)`. */
export function guideShotSlugs(markdown: string): string[] {
  return [...new Set([...markdown.matchAll(SHOT_RE)].map((m) => m[2]))]
}

/** The guide with each `shot:` image pointed at a blob URL; unknown shots become plain text. */
export function withShotUrls(markdown: string, urls: Record<string, string>): string {
  return markdown.replace(SHOT_RE, (_all, alt: string, slug: string) =>
    urls[slug] ? `![${alt}](${urls[slug]})` : `[${alt || slug}]`
  )
}
