import { describe, expect, it, vi } from 'vitest'
import { dropBuildWebTaskBranch, settleTaskBranches } from './build-web-task-branch-drop'

// Orca's task branch outlives no worktree delete (IS-147): it goes when it adds nothing, whoever
// deleted the worktree, and a branch left behind is named in the report.

function git(addsNothing = true) {
  return {
    readTaskBranch: vi.fn(async (): Promise<string | null> => 'abc'),
    taskBranchAddsNothing: vi.fn(async () => addsNothing),
    deleteTaskBranch: vi.fn(async (_sha: string) => {})
  }
}

describe('dropBuildWebTaskBranch', () => {
  it('deletes a branch that adds nothing, at the commit it read', async () => {
    const g = git()
    expect(await dropBuildWebTaskBranch({ git: g }, 'IS-344-x')).toBe('deleted')
    expect(g.deleteTaskBranch).toHaveBeenCalledWith('abc')
  })

  it('keeps a branch with commits of its own, and has nothing to do for one already gone', async () => {
    const commits = git(false)
    expect(await dropBuildWebTaskBranch({ git: commits }, 'IS-344-x')).toBe('kept:adds-commits')
    expect(commits.deleteTaskBranch).not.toHaveBeenCalled()

    const gone = git()
    gone.readTaskBranch.mockResolvedValueOnce(null)
    expect(await dropBuildWebTaskBranch({ git: gone }, 'IS-344-x')).toBe('gone')
  })

  it("deletes through the runtime's offer first, and at the commit when there is none", async () => {
    const g = git()
    const deletePreserved = vi.fn(async () => {
      throw new Error('no preserved branch')
    })
    expect(await dropBuildWebTaskBranch({ git: g, deletePreserved }, 'IS-344-x')).toBe('deleted')
    expect(deletePreserved).toHaveBeenCalledWith('abc')
    expect(g.deleteTaskBranch).toHaveBeenCalledWith('abc')
  })

  it('keeps a branch another worktree holds', async () => {
    const g = git()
    g.deleteTaskBranch.mockRejectedValueOnce(
      new Error('Local branch "IS-344-x" is checked out in another worktree.')
    )
    expect(await dropBuildWebTaskBranch({ git: g }, 'IS-344-x')).toBe('kept:checked-out')
  })
})

describe('settleTaskBranches', () => {
  it('names the branch HEAD stood on instead, and the task branch when it stays', async () => {
    const forceDeleteBranch = vi.fn(async () => ({}))
    const preserved = { branchName: 'IS-225-skill', head: 'def' }
    expect(
      await settleTaskBranches({ git: git(), forceDeleteBranch }, 'id:wt', 'is-225', preserved)
    ).toEqual(['branch kept: IS-225-skill'])
    expect(forceDeleteBranch).not.toHaveBeenCalled()
    expect(
      await settleTaskBranches({ git: git(false), forceDeleteBranch }, 'id:wt', 'is-225', undefined)
    ).toEqual(['branch kept: is-225'])
  })
})
