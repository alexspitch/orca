import { describe, expect, it } from 'vitest'
import type { GitRefEntry } from '../../../../shared/git-log-page-types'
import { gitLogBranchMenu, gitLogCommitMenu } from './git-log-menus'

const ref = (kind: GitRefEntry['kind'], shortName: string): GitRefEntry => ({
  kind,
  shortName,
  fullName: `refs/${kind === 'local' ? 'heads' : kind === 'remote' ? 'remotes' : 'tags'}/${shortName}`,
  oid: 'a'.repeat(40),
  isHead: false
})

const actions = (layout: string[]) => layout.filter((item) => item !== 'separator')

describe('gitLogBranchMenu', () => {
  it('offers every operation on another local branch', () => {
    expect(actions(gitLogBranchMenu(ref('local', 'topic'), 'main', true))).toEqual([
      'showInLog',
      'checkout',
      'newBranch',
      'checkoutAndRebase',
      'compare',
      'diffWorkingTree',
      'rebaseOnto',
      'merge',
      'update',
      'push',
      'rename',
      'delete'
    ])
  })

  it('never checks out, merges or deletes the current branch', () => {
    expect(actions(gitLogBranchMenu(ref('local', 'main'), 'main', true))).toEqual([
      'showInLog',
      'newBranch',
      'diffWorkingTree',
      'update',
      'push',
      'rename'
    ])
  })

  it('skips Checkout and Rebase on a detached HEAD', () => {
    expect(gitLogBranchMenu(ref('local', 'topic'), null, true)).not.toContain('checkoutAndRebase')
  })

  it('keeps remote and tag menus to what applies to them', () => {
    expect(actions(gitLogBranchMenu(ref('remote', 'origin/x'), 'main', true))).toEqual([
      'showInLog',
      'checkout',
      'newBranch',
      'compare',
      'diffWorkingTree',
      'rebaseOnto',
      'merge',
      'delete'
    ])
    expect(actions(gitLogBranchMenu(ref('tag', 'v1'), 'main', true))).toEqual([
      'showInLog',
      'checkout',
      'newBranch',
      'compare',
      'diffWorkingTree'
    ])
  })

  it('offers only Show in Log on a host without write support, with no stray separators', () => {
    expect(gitLogBranchMenu(ref('local', 'topic'), 'main', false)).toEqual(['showInLog'])
  })
})

describe('gitLogCommitMenu', () => {
  it('lists the reading items and the six operations', () => {
    expect(gitLogCommitMenu(true)).toEqual([
      'copyRevision',
      'cherryPick',
      'separator',
      'checkoutRevision',
      'showRepository',
      'compareWithLocal',
      'separator',
      'newBranch',
      'newTag',
      'separator',
      'child',
      'parent',
      'separator',
      'openInBrowser',
      'explain'
    ])
  })

  it('collapses separators when writes are unavailable', () => {
    expect(gitLogCommitMenu(false)).toEqual([
      'copyRevision',
      'separator',
      'child',
      'parent',
      'separator',
      'openInBrowser',
      'explain'
    ])
  })
})
