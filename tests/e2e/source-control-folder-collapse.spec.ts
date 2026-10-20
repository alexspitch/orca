/**
 * E2E: Source Control's tree folds a folder's subfolders from the folder row, every folder from a
 * section header, and a folder with all below it on Alt+click.
 */

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Page } from '@stablyai/playwright-test'
import { test, expect } from './helpers/orca-app'
import {
  cleanupGoldenWorktree,
  createGoldenWorktree,
  openGoldenSourceControl
} from './helpers/golden-source-control'
import { startHiddenRendererFrameCapture } from './helpers/hidden-renderer-frame-capture'
import { waitForSessionReady } from './helpers/store'

const FILES = ['pkg/a/one.ts', 'pkg/a/deep/two.ts', 'pkg/b/three.ts', 'lib/x/four.ts']

function writeAll(root: string, text: string): void {
  for (const file of FILES) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    writeFileSync(path.join(root, file), text)
  }
}

const entry = (page: Page, name: string) =>
  page.locator('[data-testid="source-control-entry"]').filter({ hasText: name })
const folder = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
/** The folder's row: its hover actions sit beside the toggle button. */
const folderRow = (page: Page, name: string) => folder(page, name).locator('xpath=..')

test('source control folds subfolders, whole sections and a subtree on Alt+click', async ({
  orcaPage,
  testRepoPath,
  registerPostElectronShutdownCleanup
}, testInfo) => {
  test.setTimeout(120_000)
  const fixture = createGoldenWorktree(testRepoPath, 'folders')
  registerPostElectronShutdownCleanup(async () => cleanupGoldenWorktree(testRepoPath, fixture))
  writeAll(fixture.worktreePath, 'export {}\n')
  execFileSync('git', ['add', '-A'], { cwd: fixture.worktreePath, stdio: 'pipe' })
  execFileSync('git', ['commit', '-q', '-m', 'nested files'], {
    cwd: fixture.worktreePath,
    stdio: 'pipe'
  })
  writeAll(fixture.worktreePath, 'export const changed = 1\n')

  await waitForSessionReady(orcaPage)
  await orcaPage.evaluate(() =>
    window.__store?.getState().updateSettings({ sourceControlViewMode: 'tree' })
  )
  await openGoldenSourceControl(orcaPage, testRepoPath, fixture)
  const stopCapture = await startHiddenRendererFrameCapture(orcaPage)
  const shot = async (name: string) =>
    testInfo.attach(name, {
      body: await orcaPage.screenshot({ path: path.join(testInfo.outputDir, `${name}.png`) }),
      contentType: 'image/png'
    })
  try {
    for (const name of ['one.ts', 'two.ts', 'three.ts', 'four.ts']) {
      await expect(entry(orcaPage, name)).toBeVisible({ timeout: 15_000 })
    }
    // Why: the branch section lists the same folders; closing it leaves only Changes' tree.
    await orcaPage.getByRole('button', { name: /^Committed on Branch/ }).click()
    await expect(folder(orcaPage, 'pkg')).toHaveCount(1)

    // A folder's subfolders close; the folder itself stays open.
    await folderRow(orcaPage, 'pkg').hover()
    await folderRow(orcaPage, 'pkg').getByRole('button', { name: 'Collapse subfolders' }).click()
    await expect(folder(orcaPage, 'a')).toBeVisible()
    await expect(folder(orcaPage, 'b')).toBeVisible()
    await expect(entry(orcaPage, 'one.ts')).toHaveCount(0)
    await expect(entry(orcaPage, 'three.ts')).toHaveCount(0)
    await shot('subfolders-collapsed')

    await folderRow(orcaPage, 'pkg').hover()
    await folderRow(orcaPage, 'pkg').getByRole('button', { name: 'Expand subfolders' }).click()
    await expect(entry(orcaPage, 'two.ts')).toBeVisible()

    // The section header closes every folder, then opens them all.
    await orcaPage.getByRole('button', { name: 'Collapse all folders' }).click()
    await expect(folder(orcaPage, 'pkg')).toBeVisible()
    await expect(folder(orcaPage, 'lib/x')).toBeVisible()
    await expect(folder(orcaPage, 'a')).toHaveCount(0)
    await expect(entry(orcaPage, 'four.ts')).toHaveCount(0)
    await shot('section-folders-collapsed')
    await orcaPage.getByRole('button', { name: 'Expand all folders' }).click()
    await expect(entry(orcaPage, 'two.ts')).toBeVisible()
    await expect(entry(orcaPage, 'four.ts')).toBeVisible()

    // Alt+click closes a folder with everything below; the next Alt+click opens all of it.
    await folder(orcaPage, 'pkg').click({ modifiers: ['Alt'] })
    await expect(folder(orcaPage, 'a')).toHaveCount(0)
    await folder(orcaPage, 'pkg').click({ modifiers: ['Alt'] })
    await expect(entry(orcaPage, 'two.ts')).toBeVisible()
    await expect(entry(orcaPage, 'three.ts')).toBeVisible()
    await shot('subtree-expanded')
  } finally {
    await stopCapture()
  }
})
