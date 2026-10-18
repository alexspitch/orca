/** A runtime that serves `git.logPage`, `git.refs` and `git.refsContaining` — the Git page asks first. */
export const GIT_LOG_PAGE_RUNTIME_CAPABILITY = 'git-log-page.v1'

/** A runtime that serves `git.logOperation`, `git.treeAtRevision` and `git.changedPaths`. */
export const GIT_LOG_OPERATIONS_RUNTIME_CAPABILITY = 'git-log-ops.v1'
