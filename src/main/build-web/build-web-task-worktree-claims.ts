import { worktreeIdentityKey } from '../../shared/worktree/id'

// A person's «Keep» and the finisher's delete of one task worktree (IS-147), serialized in this
// process: a Keep that starts before the delete's last check cancels the delete; once the delete
// has passed that check, the Keep is refused.

const keeping = new Map<string, number>()
const removing = new Set<string>()

export class BuildWebTaskWorktreeRemovingError extends Error {
  constructor() {
    super('This workspace is already being removed.')
    this.name = 'BuildWebTaskWorktreeRemovingError'
  }
}

/** Synchronous, so it takes its place before any await of the Keep. Returns the release. */
export function beginBuildWebKeep(worktreeId: string): () => void {
  const key = worktreeIdentityKey(worktreeId)
  if (removing.has(key)) {
    throw new BuildWebTaskWorktreeRemovingError()
  }
  keeping.set(key, (keeping.get(key) ?? 0) + 1)
  let released = false
  return () => {
    if (released) {
      return
    }
    released = true
    const left = (keeping.get(key) ?? 1) - 1
    if (left > 0) {
      keeping.set(key, left)
    } else {
      keeping.delete(key)
    }
  }
}

export function isBuildWebKeepInProgress(worktreeId: string): boolean {
  return keeping.has(worktreeIdentityKey(worktreeId))
}

/** The delete passed its last check; a Keep from now on is refused. Returns the release. */
export function beginBuildWebRemoval(worktreeId: string): () => void {
  const key = worktreeIdentityKey(worktreeId)
  removing.add(key)
  return () => {
    removing.delete(key)
  }
}
