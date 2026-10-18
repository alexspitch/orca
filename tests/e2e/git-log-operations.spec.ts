/**
 * The «Git» page's write operations, end to end through the real runtime RPC and git: New Branch
 * and New Tag from a commit, Compare with Local, Cherry-Pick, a conflicting merge that is undone,
 * Checkout, Delete of an unmerged branch, and the offer to switch to the worktree holding a branch.
 */

import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Page } from '@stablyai/playwright-test'
import { expect, test } from './helpers/orca-app'
import { waitForSessionReady } from './helpers/store'

const SIDE_BRANCH = 'git-log-ops-side'
const CONFLICT_BRANCH = 'git-log-ops-conflict'
const NEW_BRANCH = 'git-log-ops-new'
const NEW_TAG = 'git-log-ops-tag'
const SIDE_SUBJECT = 'Side commit for the Git page operations'

function git(cwd: string, args: string[], env?: NodeJS.ProcessEnv): string {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', env }).trim()
}

function gitOrNull(cwd: string, args: string[]): string | null {
  try {
    return git(cwd, args)
  } catch {
    return null
  }
}

// Why plumbing: no worktree's files or index change while the fixture commits are made.
function commitAddingFile(
  repo: string,
  parent: string,
  file: string,
  content: string,
  subject: string
): string {
  const index = path.join(os.tmpdir(), `git-log-ops-index-${randomUUID()}`)
  const env = { ...process.env, GIT_INDEX_FILE: index }
  try {
    git(repo, ['read-tree', parent], env)
    const blob = execFileSync('git', ['-C', repo, 'hash-object', '-w', '--stdin'], {
      encoding: 'utf8',
      input: content
    }).trim()
    git(repo, ['update-index', '--add', '--cacheinfo', `100644,${blob},${file}`], env)
    const tree = git(repo, ['write-tree'], env)
    return git(repo, ['commit-tree', tree, '-p', parent, '-m', subject])
  } finally {
    rmSync(index, { force: true })
  }
}

/** The worktree the page picked, as it records it for its next opening. */
async function pageWorktree(page: Page): Promise<{ id: string; path: string }> {
  let found: { id: string; path: string } | null = null
  await expect
    .poll(
      async () => {
        found = await page.evaluate(() => {
          const prefs = JSON.parse(window.localStorage.getItem('orca.gitLog.viewPrefs') ?? '{}')
          const id = prefs.lastWorktreeByRepo?.[prefs.lastRepoId]
          const all = Object.values(window.__store?.getState().worktreesByRepo ?? {}).flat()
          const worktree = all.find((each) => each.id === id)
          return worktree ? { id: worktree.id, path: worktree.path } : null
        })
        return found
      },
      { timeout: 20_000 }
    )
    .not.toBeNull()
  if (!found) {
    throw new Error('The Git page picked no worktree')
  }
  return found
}

test('Git page creates, checks out, cherry-picks, merges and deletes through its menus', async ({
  orcaPage,
  testRepoPath
}) => {
  test.setTimeout(180_000)
  await waitForSessionReady(orcaPage)
  const base = git(testRepoPath, ['rev-parse', 'HEAD'])
  const sideCommit = commitAddingFile(testRepoPath, base, 'ops-note.txt', 'side\n', SIDE_SUBJECT)
  git(testRepoPath, ['update-ref', `refs/heads/${SIDE_BRANCH}`, sideCommit])
  const conflictCommit = commitAddingFile(
    testRepoPath,
    base,
    'ops-note.txt',
    'conflict\n',
    'Conflicting commit for the Git page'
  )
  git(testRepoPath, ['update-ref', `refs/heads/${CONFLICT_BRANCH}`, conflictCommit])
  let restore: { path: string; branch: string; head: string } | null = null

  try {
    await orcaPage.evaluate(() => {
      window.__store?.getState().updateSettings({ showGitLogButton: true })
    })
    await orcaPage.getByRole('button', { name: 'Git', exact: true }).click()
    const log = orcaPage.getByRole('grid', { name: 'Commits' })
    const sideRow = log.getByRole('row').filter({ hasText: SIDE_SUBJECT })
    await expect(sideRow).toBeVisible({ timeout: 30_000 })

    const worktree = await pageWorktree(orcaPage)
    const branch = git(worktree.path, ['symbolic-ref', '--short', 'HEAD'])
    restore = { path: worktree.path, branch, head: git(worktree.path, ['rev-parse', 'HEAD']) }
    const menuItem = (name: string | RegExp) =>
      orcaPage.getByRole('menuitem', { name, exact: true })
    const branchItem = (name: string) =>
      orcaPage.getByRole('treeitem').filter({ hasText: new RegExp(`^${name}$`) })
    const fromCommitMenu = async (name: string) => {
      await sideRow.click({ button: 'right' })
      await menuItem(name).click()
    }
    // The menu follows the page's idea of the current branch, which lands after each refresh.
    const fromBranchMenu = async (target: string, name: string | RegExp) => {
      await expect(async () => {
        await orcaPage.keyboard.press('Escape')
        await branchItem(target).click({ button: 'right' })
        await menuItem(name).click({ timeout: 1_000 })
      }).toPass({ timeout: 20_000 })
    }

    // New Branch… from a commit, without checking it out.
    await fromCommitMenu('New Branch…')
    const branchDialog = orcaPage.getByRole('dialog', { name: 'New Branch' })
    await branchDialog.getByLabel('Branch name').fill(NEW_BRANCH)
    await branchDialog.getByRole('checkbox', { name: 'Checkout branch' }).click()
    await branchDialog.getByRole('button', { name: 'Create' }).click()
    await expect(branchDialog).toHaveCount(0)
    await expect(branchItem(NEW_BRANCH)).toBeVisible({ timeout: 20_000 })
    expect(git(testRepoPath, ['rev-parse', `refs/heads/${NEW_BRANCH}`])).toBe(sideCommit)
    expect(git(worktree.path, ['symbolic-ref', '--short', 'HEAD'])).toBe(branch)

    // New Tag… on the same commit.
    await fromCommitMenu('New Tag…')
    const tagDialog = orcaPage.getByRole('dialog', { name: 'New Tag' })
    await tagDialog.getByLabel('Tag name').fill(NEW_TAG)
    await tagDialog.getByRole('button', { name: 'Create' }).click()
    await expect(tagDialog).toHaveCount(0)
    await expect
      .poll(() => gitOrNull(testRepoPath, ['rev-parse', `refs/tags/${NEW_TAG}`]))
      .toBe(sideCommit)

    // Compare with Local opens the diff dialog on the commit against the working tree.
    await fromCommitMenu('Compare with Local')
    const diffDialog = orcaPage.getByRole('dialog')
    await expect(diffDialog.getByText(/↔ Local/)).toBeVisible({ timeout: 20_000 })
    await diffDialog.getByRole('button', { name: 'Close' }).click()
    await expect(diffDialog).toHaveCount(0)

    // Cherry-Pick lands the commit on the current branch.
    await fromCommitMenu('Cherry-Pick')
    await expect
      .poll(() => git(worktree.path, ['log', '-1', '--format=%s']), { timeout: 30_000 })
      .toBe(SIDE_SUBJECT)
    const picked = git(worktree.path, ['rev-parse', 'HEAD'])

    // A merge that conflicts is undone at once and leaves the worktree as it was.
    await fromBranchMenu(CONFLICT_BRANCH, `Merge '${CONFLICT_BRANCH}' into '${branch}'`)
    await expect(orcaPage.getByText('The merge hit conflicts and was undone')).toBeVisible({
      timeout: 30_000
    })
    expect(git(worktree.path, ['rev-parse', 'HEAD'])).toBe(picked)
    expect(git(worktree.path, ['status', '--porcelain'])).toBe('')
    expect(gitOrNull(worktree.path, ['rev-parse', '-q', '--verify', 'MERGE_HEAD'])).toBeNull()

    // Checkout moves the worktree to the new branch, and back.
    await fromBranchMenu(NEW_BRANCH, 'Checkout')
    await expect
      .poll(() => git(worktree.path, ['symbolic-ref', '--short', 'HEAD']), { timeout: 30_000 })
      .toBe(NEW_BRANCH)
    await fromBranchMenu(branch, 'Checkout')
    await expect
      .poll(() => git(worktree.path, ['symbolic-ref', '--short', 'HEAD']), { timeout: 30_000 })
      .toBe(branch)

    // Delete asks first, and again for a branch whose commit is on no other branch.
    await fromBranchMenu(NEW_BRANCH, 'Delete')
    await orcaPage
      .getByRole('dialog', { name: `Delete branch ${NEW_BRANCH}?` })
      .getByRole('button', { name: 'Delete' })
      .click()
    await orcaPage
      .getByRole('dialog', { name: `“${NEW_BRANCH}” is not fully merged` })
      .getByRole('button', { name: 'Delete Anyway' })
      .click()
    await expect(branchItem(NEW_BRANCH)).toHaveCount(0, { timeout: 20_000 })
    expect(
      gitOrNull(testRepoPath, ['rev-parse', '-q', '--verify', `refs/heads/${NEW_BRANCH}`])
    ).toBeNull()

    // A branch another worktree has checked out offers to switch the page to that worktree.
    const other = git(testRepoPath, ['worktree', 'list', '--porcelain'])
      .split('\n\n')
      .map((block) => ({
        path: /^worktree (.+)$/m.exec(block)?.[1] ?? '',
        branch: /^branch refs\/heads\/(.+)$/m.exec(block)?.[1] ?? null
      }))
      .find((each) => each.branch && path.resolve(each.path) !== path.resolve(worktree.path))
    if (other?.branch) {
      await fromBranchMenu(other.branch, 'Checkout')
      const held = orcaPage.getByRole('dialog', { name: /is checked out in/ })
      await held.getByRole('button', { name: /^Switch to / }).click()
      await expect.poll(async () => (await pageWorktree(orcaPage)).path).toBe(other.path)
    }
  } finally {
    if (restore) {
      gitOrNull(restore.path, ['checkout', '-q', restore.branch])
      gitOrNull(restore.path, ['reset', '-q', '--hard', restore.head])
    }
    for (const ref of [SIDE_BRANCH, CONFLICT_BRANCH, NEW_BRANCH].map(
      (name) => `refs/heads/${name}`
    )) {
      gitOrNull(testRepoPath, ['update-ref', '-d', ref])
    }
    gitOrNull(testRepoPath, ['update-ref', '-d', `refs/tags/${NEW_TAG}`])
  }
})
