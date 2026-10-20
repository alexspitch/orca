/**
 * E2E: Source Control's «Update from <base>» pulls the base branch in. A branch with no commits of
 * its own just moves to the base's new tip — no merge commit in its history.
 */

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test, expect } from './helpers/orca-app'
import {
  cleanupGoldenWorktree,
  createGoldenWorktree,
  openGoldenSourceControl
} from './helpers/golden-source-control'
import { startHiddenRendererFrameCapture } from './helpers/hidden-renderer-frame-capture'
import { waitForSessionReady } from './helpers/store'

const git = (cwd: string, args: string[]) =>
  execFileSync('git', ['-c', 'user.name=E2E', '-c', 'user.email=e2e@example.invalid', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe'
  }).trim()

test('update from base fast-forwards a branch with no commits of its own', async ({
  orcaPage,
  testRepoPath,
  registerPostElectronShutdownCleanup
}, testInfo) => {
  test.setTimeout(120_000)
  const base = git(testRepoPath, ['rev-parse', '--abbrev-ref', 'HEAD'])
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'orca-e2e-update-base-'))
  const remote = path.join(scratch, 'remote.git')
  execFileSync('git', ['init', '-q', '--bare', remote])
  git(testRepoPath, ['remote', 'add', 'origin', remote])
  git(testRepoPath, ['push', '-q', 'origin', base])
  git(testRepoPath, ['fetch', '-q', 'origin'])
  registerPostElectronShutdownCleanup(async () => {
    git(testRepoPath, ['remote', 'remove', 'origin'])
    rmSync(scratch, { recursive: true, force: true })
  })
  const fixture = createGoldenWorktree(testRepoPath, 'update-base')
  registerPostElectronShutdownCleanup(async () => cleanupGoldenWorktree(testRepoPath, fixture))

  // Someone else moves the base on.
  const other = path.join(scratch, 'other')
  execFileSync('git', ['clone', '-q', '-b', base, remote, other], { stdio: 'pipe' })
  writeFileSync(path.join(other, 'moved.txt'), 'the base moved on\n')
  git(other, ['add', '-A'])
  git(other, ['commit', '-q', '-m', 'base moved'])
  git(other, ['push', '-q', 'origin', base])
  const newTip = git(other, ['rev-parse', 'HEAD'])

  await waitForSessionReady(orcaPage)
  await orcaPage.evaluate((baseRef) => {
    const store = window.__store!
    store.setState((current) => ({
      repos: current.repos.map((repo) => ({ ...repo, worktreeBaseRef: baseRef }))
    }))
  }, `origin/${base}`)
  await openGoldenSourceControl(orcaPage, testRepoPath, fixture)
  const stopCapture = await startHiddenRendererFrameCapture(orcaPage)
  try {
    await orcaPage.getByRole('button', { name: 'More commit and remote actions' }).click()
    const update = orcaPage.getByRole('menuitem', { name: `Update from origin/${base}` })
    await expect(update).toBeVisible()
    await testInfo.attach('update-from-base-menu', {
      body: await orcaPage.screenshot({
        path: path.join(testInfo.outputDir, 'update-from-base-menu.png')
      }),
      contentType: 'image/png'
    })
    await update.click()

    await expect
      .poll(() => git(fixture.worktreePath, ['rev-parse', 'HEAD']), { timeout: 30_000 })
      .toBe(newTip)
    // Moved, not merged: the tip is the base's own commit with its single parent.
    expect(
      git(fixture.worktreePath, ['rev-list', '--parents', '-n', '1', 'HEAD']).split(' ')
    ).toHaveLength(2)
    expect(git(fixture.worktreePath, ['rev-parse', '--abbrev-ref', 'HEAD'])).toBe(
      fixture.branchName
    )
  } finally {
    await stopCapture()
  }
})
