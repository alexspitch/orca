import type { BuildWebBuildFreshness } from '../../../../../../shared/build-web-run-types'

const SUBJECT_MAX = 25

/** The commits a stale build misses, one subject a line, cut to 25 characters; `…` when the console listed only some. */
export function missingCommitLines(f: BuildWebBuildFreshness): string[] {
  const lines = (f.missing ?? []).map((c) => {
    const subject = c.subject.trim()
    return subject.length > SUBJECT_MAX ? `${subject.slice(0, SUBJECT_MAX - 1)}…` : subject
  })
  return lines.length && f.missing_more ? [...lines, '…'] : lines
}
