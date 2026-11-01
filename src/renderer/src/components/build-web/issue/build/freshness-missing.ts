import type { BuildWebBuildFreshness } from '../../../../../../shared/build-web-run-types'

/** The commits a stale build misses, one line each: short sha and subject; `…` when the console listed only some. */
export function missingCommitLines(f: BuildWebBuildFreshness): string[] {
  const lines = (f.missing ?? []).map((c) => `${c.sha.slice(0, 8)} ${c.subject}`.trim())
  return lines.length && f.missing_more ? [...lines, '…'] : lines
}
