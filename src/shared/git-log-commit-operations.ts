import {
  GIT_LOG_TREE_MAX_PATHS,
  type GitLogChangedPath,
  type GitLogOperationResult,
  type GitLogTreeAtRevision
} from './git-log-operation-types'
import {
  abortStoppedOperation,
  done,
  failed,
  gitFailureMessage,
  isFullOid,
  isValidRefName,
  stoppedWorkIssue,
  type GitLogRun
} from './git-log-operation-outcome'

export async function cherryPick(run: GitLogRun, commit: string): Promise<GitLogOperationResult> {
  if (!isFullOid(commit)) {
    return failed(`Not a commit: ${commit}`)
  }
  let mainline: string[] = []
  try {
    const { stdout } = await run.git(['rev-list', '--parents', '-n', '1', commit], run.cwd)
    // Why: a merge commit needs a parent to diff against; WebStorm uses the first one.
    mainline = stdout.trim().split(/\s+/).length > 2 ? ['-m', '1'] : []
  } catch (error) {
    return failed(gitFailureMessage(error))
  }
  const issue = await stoppedWorkIssue(run)
  if (issue) {
    return issue
  }
  try {
    await run.git(['cherry-pick', ...mainline, commit], run.cwd)
    return done()
  } catch (error) {
    return abortStoppedOperation(run, 'cherry-pick', error)
  }
}

export async function createTag(
  run: GitLogRun,
  name: string,
  commit: string,
  message: string | undefined
): Promise<GitLogOperationResult> {
  if (!isFullOid(commit)) {
    return failed(`Not a commit: ${commit}`)
  }
  if (!(await isValidRefName(run, name, 'tag'))) {
    return failed(`“${name}” is not a valid tag name.`)
  }
  const note = message?.trim()
  try {
    await run.git(note ? ['tag', '-a', name, '-m', note, commit] : ['tag', name, commit], run.cwd)
    return done()
  } catch (error) {
    return failed(gitFailureMessage(error))
  }
}

/** Every file of one commit's tree (Show Repository at Revision), capped. */
export async function listTreeAtRevision(
  run: GitLogRun,
  commit: string
): Promise<GitLogTreeAtRevision> {
  if (!isFullOid(commit)) {
    throw new Error(`Not a commit: ${commit}`)
  }
  const { stdout } = await run.git(
    ['ls-tree', '-r', '-z', '--name-only', '--full-tree', commit],
    run.cwd
  )
  const paths = stdout.split('\0').filter(Boolean)
  return {
    paths: paths.slice(0, GIT_LOG_TREE_MAX_PATHS),
    truncated: paths.length > GIT_LOG_TREE_MAX_PATHS
  }
}

const STATUS_BY_LETTER: Record<string, GitLogChangedPath['status']> = {
  M: 'modified',
  T: 'modified',
  A: 'added',
  D: 'deleted',
  R: 'renamed',
  C: 'copied'
}

export function parseNameStatus(stdout: string): GitLogChangedPath[] {
  const fields = stdout.split('\0')
  const changes: GitLogChangedPath[] = []
  for (let index = 0; index < fields.length;) {
    const letter = fields[index]?.charAt(0) ?? ''
    const status = STATUS_BY_LETTER[letter]
    if (!status) {
      // Why two: every -z status is followed by its path (an unmerged U too).
      index += letter ? 2 : 1
      continue
    }
    if (status === 'renamed' || status === 'copied') {
      const oldPath = fields[index + 1]
      const path = fields[index + 2]
      if (oldPath && path) {
        changes.push({ path, oldPath, status })
      }
      index += 3
    } else {
      const path = fields[index + 1]
      if (path) {
        changes.push({ path, status })
      }
      index += 2
    }
  }
  return changes
}

/** Files that differ from `base`: in `target`, or in the working tree when `target` is null. */
export async function listChangedPaths(
  run: GitLogRun,
  base: string,
  target: string | null
): Promise<GitLogChangedPath[]> {
  if (!isFullOid(base) || (target !== null && !isFullOid(target))) {
    throw new Error('Expected full commit ids')
  }
  // Why autoRefreshIndex off: a read must not take index.lock from a commit running beside it.
  const { stdout } = await run.git(
    [
      '-c',
      'diff.autoRefreshIndex=false',
      'diff',
      '--name-status',
      '-z',
      '-M',
      base,
      ...(target ? [target] : []),
      '--'
    ],
    run.cwd
  )
  return parseNameStatus(stdout)
}
