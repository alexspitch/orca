import type {
  BuildWebBuildFreshness,
  BuildWebMissingCommit
} from '../../../../../../shared/build-web-run-types'

const SUBJECT_MAX = 25

/** One subject a line, cut to 25 characters; `…` when the console listed only some. */
export function commitSubjectLines(
  commits: readonly BuildWebMissingCommit[] | undefined,
  more: boolean | undefined
): string[] {
  const lines = (commits ?? []).map((c) => {
    const subject = c.subject.trim()
    return subject.length > SUBJECT_MAX ? `${subject.slice(0, SUBJECT_MAX - 1)}…` : subject
  })
  return lines.length && more ? [...lines, '…'] : lines
}

/** The commits a stale build misses. */
export function missingCommitLines(f: BuildWebBuildFreshness): string[] {
  return commitSubjectLines(f.missing, f.missing_more)
}
