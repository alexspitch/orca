import { describe, expect, it } from 'vitest'
import type { BuildWebIssueRow } from '../../../../shared/build-web-types'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import {
  isChatPlatformBatch,
  defaultTakeToWorkWorktree,
  takeToWorkCandidates,
  takeToWorkPrompt,
  takeToWorkRepos,
  takenWorktreeNames,
  taskWorktreeName,
  validateBuildWebBatch
} from './build-web-take-to-work'

const issue = (key: string, over: Partial<BuildWebIssueRow> = {}): BuildWebIssueRow => ({
  id: key,
  key,
  product: 'sa',
  title: key,
  type: 'bug',
  status: 'todo',
  priority: 3,
  parent_id: null,
  parent_key: null,
  children: 0,
  children_open: 0,
  favorite: false,
  for_ai: true,
  assignee: '',
  version_id: 'v31',
  version_name: '3.1',
  jira_key: null,
  updated_at: '',
  agent_session: null,
  url: '',
  ...over
})

describe('take to work', () => {
  it('takes one task, and only one', () => {
    expect(validateBuildWebBatch([issue('IS-2.1')])).toEqual({ ok: true })
    expect(validateBuildWebBatch([issue('IS-1'), issue('IS-2')])).toEqual({
      ok: false,
      reason: 'too-many',
      groups: []
    })
    expect(validateBuildWebBatch([]).ok).toBe(false)
  })

  it('refuses a key that could carry anything into a terminal', () => {
    expect(validateBuildWebBatch([issue('IS-1\nrm -rf /')]).ok).toBe(false)
  })

  it('refuses a task whose product Orca does not know', () => {
    expect(validateBuildWebBatch([issue('IS-1', { product: 'unknown' })])).toEqual({
      ok: false,
      reason: 'unknown-product',
      groups: ['IS-1']
    })
  })
})

describe('skill call', () => {
  it('codes the one task in the worktree Orca made', () => {
    expect(takeToWorkPrompt('IS-1', { auto: false })).toBe(
      '/build-web-tasks code IS-1 -no-worktree'
    )
    expect(takeToWorkPrompt('IS-2.1', { auto: true })).toBe(
      '/build-web-tasks code IS-2.1 -no-worktree -auto'
    )
    expect(() => takeToWorkPrompt('IS-1 -auto; whoami', { auto: false })).toThrow()
  })

  it('sends the person’s instruction after the skill call, on lines of its own', () => {
    expect(
      takeToWorkPrompt('IS-1', { auto: false, instruction: '  Keep the API as is.\nNo new deps. ' })
    ).toBe(
      '/build-web-tasks code IS-1 -no-worktree\n\nAdditional instruction from the person who took this task to work:\nKeep the API as is.\nNo new deps.'
    )
    expect(takeToWorkPrompt('IS-1', { auto: false, instruction: '   ' })).toBe(
      '/build-web-tasks code IS-1 -no-worktree'
    )
  })

  it('keeps a Chat Platform task’s call, which makes chat-platform’s worktree itself', () => {
    expect(takeToWorkPrompt('CPDEV-12', { auto: true, ownWorktree: true })).toBe(
      '/build-web-tasks batch CPDEV-12 -auto'
    )
    expect(isChatPlatformBatch([{ product: 'cp' }])).toBe(true)
    expect(isChatPlatformBatch([{ product: 'dc' }])).toBe(false)
    expect(isChatPlatformBatch([])).toBe(false)
  })
})

describe('worktree candidates', () => {
  const repo = (id: string, path: string, kind?: Repo['kind']): Repo =>
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: a test fixture needs only the fields the function reads.
    ({ id, path, displayName: path.split('/').pop() ?? id, kind }) as Repo
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: a test fixture needs only the fields the function reads.
  const wt = (id: string, repoId: string): Worktree => ({ id, repoId, displayName: id }) as Worktree

  it('prefers worktrees of the build-web repository', () => {
    const repos = [repo('a', '/p/sa-dc-ap-products-master'), repo('b', '/p/orca')]
    const result = takeToWorkCandidates(repos, { a: [wt('a::1', 'a')], b: [wt('b::1', 'b')] })
    expect(result).toEqual({ worktrees: [wt('a::1', 'a')], matchedRepo: true })
  })

  it('never offers an archived worktree', () => {
    const repos = [repo('a', '/p/sa-dc-ap-products-master')]
    const archived = { ...wt('a::old', 'a'), isArchived: true }
    const result = takeToWorkCandidates(repos, { a: [archived, wt('a::1', 'a')] })
    expect(result.worktrees.map((w) => w.id)).toEqual(['a::1'])
  })

  it('falls back to every git worktree, skipping folder workspaces', () => {
    const repos = [repo('b', '/p/orca'), repo('f', '/p/notes', 'folder')]
    const result = takeToWorkCandidates(repos, { b: [wt('b::1', 'b')], f: [wt('f::1', 'f')] })
    expect(result).toEqual({ worktrees: [wt('b::1', 'b')], matchedRepo: false })
  })

  it('defaults to the active worktree, then the last used, then the first', () => {
    const candidates = [wt('x', 'a'), wt('y', 'a')]
    expect(defaultTakeToWorkWorktree(candidates, 'y', 'x')).toBe('y')
    expect(defaultTakeToWorkWorktree(candidates, 'other', 'x')).toBe('x')
    expect(defaultTakeToWorkWorktree(candidates, null, null)).toBe('x')
    expect(defaultTakeToWorkWorktree([], 'y', 'x')).toBeNull()
  })
})

describe('the task’s own worktree', () => {
  it('is named after its key, with a suffix while the name is taken', () => {
    expect(taskWorktreeName('IS-13.1')).toBe('is-13-1')
    const taken = takenWorktreeNames([
      { displayName: 'Something else', path: '/w/is-12', branch: 'refs/heads/alex/is-12-2' },
      { displayName: 'IS-12-3' }
    ])
    expect(taskWorktreeName('IS-12', taken)).toBe('is-12-4')
  })

  it('goes into the build-web repository when there is one', () => {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: a test fixture needs only the fields the function reads.
    const repo = (id: string, path: string) => ({ id, path, displayName: id }) as Repo
    expect(
      takeToWorkRepos([repo('a', '/p/sa-dc-ap-products'), repo('b', '/p/orca')]).repos.map(
        (r) => r.id
      )
    ).toEqual(['a'])
    expect(takeToWorkRepos([repo('b', '/p/orca')])).toMatchObject({ matchedRepo: false })
  })
})
