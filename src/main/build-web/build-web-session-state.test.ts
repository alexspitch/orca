import { describe, expect, it } from 'vitest'
import type { WorktreeBuildWebSession } from '../../shared/build-web-session-types'
import { watchedBuildWebSessionChange } from './build-web-session-state'

// The watcher mirrors the console, but an attention the finisher raised stays until the task
// leaves the closed states; Keep and removal clear it on their own paths.

const at = 1
const commits: WorktreeBuildWebSession = { state: 'attention', reason: 'commits', at }
const overdue: WorktreeBuildWebSession = { state: 'attention', reason: 'skill-unfinished', at }
const live = (state: 'active' | 'waiting' | 'closing', finish_overdue = false) => ({
  state,
  finish_overdue
})

describe('watchedBuildWebSessionChange', () => {
  it("keeps the finisher's attention while the task stays closed", () => {
    expect(watchedBuildWebSessionChange(commits, live('closing'))).toEqual({ kind: 'none' })
    expect(watchedBuildWebSessionChange(commits, live('closing', true))).toEqual({ kind: 'none' })
  })

  it("clears the finisher's attention when the task is back in work or awaiting release", () => {
    expect(watchedBuildWebSessionChange(commits, live('active'))).toEqual({
      kind: 'set',
      session: { state: 'active' }
    })
    expect(watchedBuildWebSessionChange(commits, live('waiting'))).toEqual({
      kind: 'set',
      session: { state: 'waiting' }
    })
  })

  it('replaces its own attentions as the console answers', () => {
    expect(watchedBuildWebSessionChange(overdue, live('closing'))).toEqual({
      kind: 'set',
      session: { state: 'closing' }
    })
    expect(watchedBuildWebSessionChange({ state: 'closing', at }, live('closing', true))).toEqual({
      kind: 'set',
      session: { state: 'attention', reason: 'skill-unfinished' }
    })
  })

  it('writes only a change, never a new timestamp alone', () => {
    expect(watchedBuildWebSessionChange({ state: 'waiting', at }, live('waiting'))).toEqual({
      kind: 'none'
    })
  })

  it('maps the ended states', () => {
    expect(
      watchedBuildWebSessionChange(commits, { state: 'replaced', finish_overdue: false })
    ).toEqual({
      kind: 'set',
      session: { state: 'attention', reason: 'replaced' }
    })
    expect(watchedBuildWebSessionChange(commits, { state: 'kept', finish_overdue: false })).toEqual(
      {
        kind: 'clear-task'
      }
    )
    expect(
      watchedBuildWebSessionChange(
        { state: 'active', at },
        { state: 'abandoned', finish_overdue: false }
      )
    ).toEqual({ kind: 'clear-session' })
    expect(
      watchedBuildWebSessionChange(undefined, { state: 'removed', finish_overdue: false })
    ).toEqual({
      kind: 'none'
    })
  })

  it('marks a closed task cleanup-off when auto-remove is off, over a wait or a late skill', () => {
    const cleanupOff = { kind: 'set', session: { state: 'attention', reason: 'cleanup-off' } }
    const agentRunning: WorktreeBuildWebSession = {
      state: 'attention',
      reason: 'agent-running',
      at
    }
    expect(watchedBuildWebSessionChange({ state: 'closing', at }, live('closing'), false)).toEqual(
      cleanupOff
    )
    expect(watchedBuildWebSessionChange(agentRunning, live('closing'), false)).toEqual(cleanupOff)
    expect(watchedBuildWebSessionChange(overdue, live('closing', true), false)).toEqual(cleanupOff)
    // What the finisher found in the worktree stays as it is.
    expect(watchedBuildWebSessionChange(commits, live('closing'), false)).toEqual({ kind: 'none' })
    // Only a closed task waits on the setting.
    expect(watchedBuildWebSessionChange(undefined, live('active'), false)).toEqual({
      kind: 'set',
      session: { state: 'active' }
    })
  })

  it('lets cleanup-off give way to the console once auto-remove is back on', () => {
    const off: WorktreeBuildWebSession = { state: 'attention', reason: 'cleanup-off', at }
    expect(watchedBuildWebSessionChange(off, live('closing'))).toEqual({
      kind: 'set',
      session: { state: 'closing' }
    })
    expect(watchedBuildWebSessionChange(off, live('closing', true))).toEqual({
      kind: 'set',
      session: { state: 'attention', reason: 'skill-unfinished' }
    })
  })
})
