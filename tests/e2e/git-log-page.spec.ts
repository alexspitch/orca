/**
 * The «Git» page (WebStorm's Git › Log): opened from the sidebar, it lists every branch's
 * commits through the real runtime RPC, shows the selected commit's files and message, filters
 * by text, and closes on Escape. Needs a real Electron app: the log comes from main's git.
 */

import { execFileSync } from 'node:child_process'
import { expect, test } from './helpers/orca-app'
import { waitForSessionReady } from './helpers/store'

const SIDE_BRANCH = 'git-log-page-e2e'
const SIDE_SUBJECT = 'Side branch commit for the Git page'

function git(repoPath: string, args: string[]): string {
  return execFileSync('git', ['-C', repoPath, ...args], { encoding: 'utf8' }).trim()
}

test('Git page shows every branch, opens a file’s diff, filters, and restores what was picked', async ({
  orcaPage,
  testRepoPath
}) => {
  test.setTimeout(120_000)
  await waitForSessionReady(orcaPage)
  // A commit on a branch nobody has checked out: only an all-branch log shows it.
  const tree = git(testRepoPath, ['rev-parse', 'HEAD^{tree}'])
  const head = git(testRepoPath, ['rev-parse', 'HEAD'])
  const sideCommit = git(testRepoPath, ['commit-tree', tree, '-p', head, '-m', SIDE_SUBJECT])
  git(testRepoPath, ['update-ref', `refs/heads/${SIDE_BRANCH}`, sideCommit])

  try {
    await orcaPage.evaluate(() => {
      const store = window.__store
      if (!store) {
        throw new Error('window.__store is not available')
      }
      store.getState().updateSettings({ showGitLogButton: true })
    })
    await orcaPage.getByRole('button', { name: 'Git', exact: true }).click()

    const log = orcaPage.getByRole('grid', { name: 'Commits' })
    await expect(log.getByRole('row').filter({ hasText: SIDE_SUBJECT })).toBeVisible({
      timeout: 30_000
    })
    const initial = log.getByRole('row').filter({ hasText: 'Initial commit for E2E tests' })
    await expect(initial).toBeVisible()

    // The branch tree lists the side branch under Local.
    await expect(
      orcaPage.getByRole('tree').getByRole('treeitem').filter({ hasText: SIDE_BRANCH })
    ).toBeVisible()

    // Selecting the seed commit shows its files and its message.
    await initial.click()
    const files = orcaPage.getByRole('tree', { name: 'Changed files' })
    await expect(files.getByRole('treeitem').filter({ hasText: 'README.md' })).toBeVisible({
      timeout: 20_000
    })
    await expect(orcaPage.getByText('Initial commit for E2E tests').last()).toBeVisible()

    // A click on a file opens its diff in a modal; Next/Previous File walk the commit's files.
    await files.getByRole('treeitem').filter({ hasText: 'README.md' }).click()
    const dialog = orcaPage.getByRole('dialog')
    const title = dialog.getByRole('heading')
    await expect(title).toHaveText('README.md', { timeout: 20_000 })
    // README.md is the last of the seed commit's files in tree order: go back, then forward.
    await dialog.getByRole('button', { name: 'Previous File' }).click()
    await expect(title).not.toHaveText('README.md')
    await dialog.getByRole('button', { name: 'Next File' }).click()
    await expect(title).toHaveText('README.md')
    // The diff itself renders: Monaco shows the added README line.
    await expect(dialog.getByText('Orca E2E Test Repo').first()).toBeVisible({ timeout: 20_000 })
    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(log).toBeVisible()

    // The text filter asks git again and keeps only the matching commit.
    await orcaPage.getByRole('textbox', { name: 'Text or hash' }).fill('Side branch')
    await expect(initial).toHaveCount(0, { timeout: 20_000 })
    await expect(log.getByRole('row').filter({ hasText: SIDE_SUBJECT })).toBeVisible()

    // Escape outside a field closes the page. Wait out the sidebar's 12 s "board moved" tip first:
    // while it is held open, Radix gives it every Escape.
    await expect(orcaPage.getByRole('tooltip')).toHaveCount(0, { timeout: 20_000 })
    await log.focus()
    await orcaPage.keyboard.press('Escape')
    await expect(log).toHaveCount(0, { timeout: 10_000 })

    // While the page is closed the side branch gains a commit: the cached log must notice.
    const newerCommit = git(testRepoPath, [
      'commit-tree',
      tree,
      '-p',
      sideCommit,
      '-m',
      'Newer side commit for the Git page cache'
    ])
    git(testRepoPath, ['update-ref', `refs/heads/${SIDE_BRANCH}`, newerCommit])

    // Reopening restores the commit and the file picked before, and reads the moved refs.
    await orcaPage.getByRole('button', { name: 'Git', exact: true }).click()
    await expect(log.getByRole('row', { selected: true })).toContainText(
      'Initial commit for E2E tests',
      { timeout: 30_000 }
    )
    await expect(files.getByRole('treeitem', { selected: true })).toContainText('README.md', {
      timeout: 20_000
    })
    await expect(
      log.getByRole('row').filter({ hasText: 'Newer side commit for the Git page cache' })
    ).toBeVisible({ timeout: 30_000 })
  } finally {
    git(testRepoPath, ['update-ref', '-d', `refs/heads/${SIDE_BRANCH}`])
  }
})
