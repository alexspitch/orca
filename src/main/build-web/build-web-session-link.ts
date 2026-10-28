import type { Worktree } from '../../shared/worktree/types'
import { setBuildWebAgentSession, type BuildWebSessionInput } from './build-web-issue-write'
import type {
  WorktreeBuildWebSession,
  WorktreeBuildWebTask
} from '../../shared/build-web-session-types'

// The worktree → session link (IS-147) is written by the host that owns the worktree, so it holds
// even when the client that started the agent dropped off right after the console answered.

export type BuildWebSessionLinkRuntime = {
  showManagedWorktree: (selector: string) => Promise<Worktree>
  updateManagedWorktreeMeta: (
    selector: string,
    updates: {
      buildWebTask?: WorktreeBuildWebTask | null
      buildWebSession?: WorktreeBuildWebSession | null
    }
  ) => Promise<unknown>
}

/** Record the console's session row on the worktree made for that task; any other worktree is left alone. */
export async function linkBuildWebSessionToWorktree(
  runtime: BuildWebSessionLinkRuntime,
  args: { worktreeId: string; issueId: string; sessionId: string }
): Promise<boolean> {
  const selector = `id:${args.worktreeId}`
  const worktree = await runtime.showManagedWorktree(selector).catch(() => null)
  const task = worktree?.buildWebTask
  if (!task || task.issueId !== args.issueId || task.sessionId === args.sessionId) {
    return false
  }
  await runtime.updateManagedWorktreeMeta(selector, {
    buildWebTask: { ...task, sessionId: args.sessionId }
  })
  return true
}

/** `buildWeb.setAgentSession` on the host: the console's write, then the worktree's link to it. */
export async function setBuildWebAgentSessionOnHost(
  runtime: BuildWebSessionLinkRuntime,
  args: { id: string; session: BuildWebSessionInput; worktreeId?: string }
): ReturnType<typeof setBuildWebAgentSession> {
  const result = await setBuildWebAgentSession(args.id, args.session)
  if (result.ok && typeof result.value === 'string' && args.worktreeId) {
    // Why swallowed: the console holds the session either way, and the watcher heals a missing link.
    await linkBuildWebSessionToWorktree(runtime, {
      worktreeId: args.worktreeId,
      issueId: args.id,
      sessionId: result.value
    }).catch(() => false)
  }
  return result
}
