import { describe, expect, it } from 'vitest'
import type { BuildWebIssueRow } from '../../../../shared/build-web-types'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import {
  buildWebBatchPrompt,
  defaultTakeToWorkWorktree,
  takeToWorkCandidates,
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

describe('take to work batch', () => {
  it('accepts one product and one release', () => {
    expect(validateBuildWebBatch([issue('IS-1'), issue('IS-2.1')])).toEqual({ ok: true })
  })

  it('refuses a mix and names the groups', () => {
    const check = validateBuildWebBatch([
      issue('IS-1'),
      issue('IS-2'),
      issue('IS-3', { product: 'dc', version_id: 'v216', version_name: '2.16' }),
      issue('IS-4', { version_id: null, version_name: null })
    ])
    expect(check).toEqual({
      ok: false,
      reason: 'mixed',
      groups: ['SA 3.1 (2)', 'DC 2.16 (1)', 'SA — (1)']
    })
  })

  it('refuses keys that could carry anything into a terminal, and big batches', () => {
    expect(validateBuildWebBatch([issue('IS-1\nrm -rf /')]).ok).toBe(false)
    expect(validateBuildWebBatch(Array.from({ length: 21 }, (_, i) => issue(`IS-${i}`))).ok).toBe(
      false
    )
    expect(validateBuildWebBatch([]).ok).toBe(false)
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
  it('is only the skill, the keys and fixed flags', () => {
    expect(
      buildWebBatchPrompt(['IS-1', 'SDAP-4242', 'IS-1'], { noWorktree: true, auto: false })
    ).toBe('/build-web-tasks batch IS-1 SDAP-4242 -no-worktree')
    expect(buildWebBatchPrompt(['IS-2.1'], { noWorktree: false, auto: true })).toBe(
      '/build-web-tasks batch IS-2.1 -auto'
    )
    expect(() =>
      buildWebBatchPrompt(['IS-1 -auto; whoami'], { noWorktree: false, auto: false })
    ).toThrow()
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
