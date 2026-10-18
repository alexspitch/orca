import { GIT_LOG_PAGE_RUNTIME_CAPABILITY } from '../../../../shared/git-log-page-capability'
import type {
  GitLogPageResult,
  GitLogQuery,
  GitRefsContainingResult,
  GitRefsResult
} from '../../../../shared/git-log-page-types'
import { GIT_HISTORY_MAX_LIMIT, type GitHistoryItem } from '../../../../shared/git-history'
import type { RuntimeGitContext } from '@/runtime/runtime-git-client-context'
import { getRuntimeGitHistory } from '@/runtime/runtime-git-status-client'
import { callRuntimeRpc, runtimeEnvironmentSupportsCapability } from '@/runtime/runtime-rpc-client'
import { toRuntimeWorktreeSelector } from '@/runtime/runtime-worktree-selector'
import type { RuntimeCapability } from '../../../../shared/protocol-version'

const LOG_TIMEOUT_MS = 60_000

/**
 * Why the host can't serve the Git page: a paired server or this app's main process is older, or
 * the project lives on an SSH host, whose git main reaches only through Source Control's calls.
 */
export type GitLogUnsupportedReason = 'outdated-server' | 'outdated-app' | 'ssh'

export type GitLogPageLoad = GitLogPageResult & {
  /** Set when only HEAD's history could be read (filtered here), and why. */
  headOnly: GitLogUnsupportedReason | null
}

// Why cached: a window's main process doesn't change under it; restarting Orca reloads the window.
const localCapabilities = new Map<RuntimeCapability, Promise<boolean>>()

/**
 * Whether the host announces `capability`: a paired server can be older than this client, and in
 * development a hot-reloaded window can be newer than the main process it talks to.
 */
export async function gitLogUnsupportedReason(
  context: RuntimeGitContext,
  capability: RuntimeCapability = GIT_LOG_PAGE_RUNTIME_CAPABILITY
): Promise<GitLogUnsupportedReason | null> {
  const { target } = context
  if (target.kind === 'local' && context.connectionId) {
    return 'ssh'
  }
  if (target.kind === 'environment') {
    const served = await runtimeEnvironmentSupportsCapability(target.environmentId, capability)
    return served ? null : 'outdated-server'
  }
  let served = localCapabilities.get(capability)
  if (!served) {
    served = window.api.runtime.getStatus().then(
      (status) => status.capabilities?.includes(capability) === true,
      () => {
        // A failed status read says nothing about the methods; ask again next time.
        localCapabilities.delete(capability)
        return true
      }
    )
    localCapabilities.set(capability, served)
  }
  return (await served) ? null : 'outdated-app'
}

const unsupportedReason = (context: RuntimeGitContext) => gitLogUnsupportedReason(context)

export function selectorOf(context: RuntimeGitContext): string {
  return toRuntimeWorktreeSelector(context.worktreeId ?? '')
}

const DAY_MS = 24 * 60 * 60 * 1000
const HASH_PREFIX = /^[0-9a-f]{4,64}$/i

/** What the host does for `git.logPage`, done here over an older server's HEAD history. */
function textMatcher(query: GitLogQuery): (message: string) => boolean {
  const text = query.text?.trim()
  if (!text) {
    return () => true
  }
  if (query.regex) {
    try {
      const pattern = new RegExp(text, query.matchCase ? '' : 'i')
      return (message) => pattern.test(message)
    } catch {
      return () => false
    }
  }
  const needle = query.matchCase ? text : text.toLowerCase()
  return (message) => (query.matchCase ? message : message.toLowerCase()).includes(needle)
}

function filterHeadHistory(items: readonly GitHistoryItem[], query: GitLogQuery): GitHistoryItem[] {
  const matchesText = textMatcher(query)
  const text = query.text?.trim() ?? ''
  const hash = HASH_PREFIX.test(text) ? text.toLowerCase() : null
  const author = query.author?.trim().toLowerCase()
  const since = query.sinceDays ? Date.now() - query.sinceDays * DAY_MS : null
  return items.filter(
    (item) =>
      (matchesText(item.message) || (hash !== null && item.id.startsWith(hash))) &&
      (!author || (item.author ?? '').toLowerCase().includes(author)) &&
      (since === null || (item.timestamp ?? 0) >= since)
  )
}

export async function loadGitLogPage(
  context: RuntimeGitContext,
  query: GitLogQuery
): Promise<GitLogPageLoad> {
  const reason = await unsupportedReason(context)
  if (reason) {
    // Why one page: the older history call has no paging, so the first page holds all it returns.
    if ((query.skip ?? 0) > 0) {
      return { items: [], hasMore: false, limit: 0, nextSkip: 0, headOnly: reason }
    }
    const history = await getRuntimeGitHistory(context, {
      limit: GIT_HISTORY_MAX_LIMIT
    })
    return {
      items: filterHeadHistory(history.items, query),
      currentRef: history.currentRef,
      hasMore: false,
      limit: history.limit,
      nextSkip: history.items.length,
      headOnly: reason
    }
  }
  const result = await callRuntimeRpc<GitLogPageResult>(
    context.target,
    'git.logPage',
    { worktree: selectorOf(context), ...query },
    { timeoutMs: LOG_TIMEOUT_MS }
  )
  return { ...result, headOnly: null }
}

/** The refs, or why the host can't list them. */
export async function loadGitRefs(
  context: RuntimeGitContext
): Promise<GitRefsResult | { unsupported: GitLogUnsupportedReason }> {
  const reason = await unsupportedReason(context)
  if (reason) {
    return { unsupported: reason }
  }
  return callRuntimeRpc<GitRefsResult>(
    context.target,
    'git.refs',
    { worktree: selectorOf(context) },
    { timeoutMs: LOG_TIMEOUT_MS }
  )
}

/** Null when the host predates the Git page. */
export async function loadGitRefsContaining(
  context: RuntimeGitContext,
  commitId: string
): Promise<string[] | null> {
  if (await unsupportedReason(context)) {
    return null
  }
  const result = await callRuntimeRpc<GitRefsContainingResult>(
    context.target,
    'git.refsContaining',
    { worktree: selectorOf(context), commitId },
    { timeoutMs: LOG_TIMEOUT_MS }
  )
  return result.refs
}
