import { describe, expect, it } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { resolveGitLogSelection, type GitLogSelectionInput } from './resolve-git-log-selection'

function repo(id: string, kind: Repo['kind'] = 'git'): Repo {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the resolver reads only id and kind; the rest of Repo is irrelevant here.
  return { id, kind, path: `/${id}`, displayName: id } as Repo
}

function worktree(id: string, repoId: string, isMainWorktree = false): Worktree {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the resolver reads only id, repoId and isMainWorktree.
  return { id, repoId, isMainWorktree, path: `/${id}` } as Worktree
}

const BASE: GitLogSelectionInput = {
  repos: [repo('folder', 'folder'), repo('a'), repo('b')],
  worktreesByRepo: {
    a: [worktree('a-feature', 'a'), worktree('a-main', 'a', true)],
    b: [worktree('b-main', 'b', true), worktree('b-fix', 'b')]
  },
  defaultRepoId: null,
  activeWorktree: null,
  lastRepoId: null,
  lastWorktreeByRepo: {},
  pickedRepoId: null,
  pickedWorktreeId: null
}

const pick = (input: Partial<GitLogSelectionInput>) => {
  const { repo: picked, worktree: picked2 } = resolveGitLogSelection({
    ...BASE,
    ...input
  })
  return [picked?.id ?? null, picked2?.id ?? null]
}

describe('resolveGitLogSelection', () => {
  it('opens the default project from Settings over the active one', () => {
    expect(pick({ defaultRepoId: 'b', activeWorktree: worktree('a-feature', 'a') })).toEqual([
      'b',
      'b-main'
    ])
  })

  it('ignores a default that is gone or a folder, and follows the active worktree', () => {
    expect(
      pick({
        defaultRepoId: 'gone',
        activeWorktree: worktree('a-feature', 'a')
      })
    ).toEqual(['a', 'a-feature'])
    expect(pick({ defaultRepoId: 'folder' })).toEqual(['a', 'a-main'])
  })

  it('falls back to the last project and worktree opened here', () => {
    expect(pick({ lastRepoId: 'b', lastWorktreeByRepo: { b: 'b-fix' } })).toEqual(['b', 'b-fix'])
  })

  it('takes the main checkout, then the first worktree', () => {
    expect(pick({})).toEqual(['a', 'a-main'])
    expect(pick({ worktreesByRepo: { a: [worktree('a-x', 'a')] } })).toEqual(['a', 'a-x'])
  })

  it('lets a header pick win over everything', () => {
    expect(
      pick({
        defaultRepoId: 'a',
        pickedRepoId: 'b',
        pickedWorktreeId: 'b-fix'
      })
    ).toEqual(['b', 'b-fix'])
  })

  it('has nothing to show without a Git project', () => {
    expect(pick({ repos: [repo('folder', 'folder')] })).toEqual([null, null])
  })
})
