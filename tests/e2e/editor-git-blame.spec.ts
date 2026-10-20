/**
 * E2E: «Git Blame» from the line-number menu shows who last changed each line beside the editor,
 * a line not committed yet says so, a hover names the commit and a click opens its change.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Page } from '@stablyai/playwright-test'
import { test, expect } from './helpers/orca-app'
import { startHiddenRendererFrameCapture } from './helpers/hidden-renderer-frame-capture'
import { waitForActiveWorktree, waitForSessionReady } from './helpers/store'

async function worktreePath(page: Page): Promise<string> {
  return page.evaluate(() => {
    const state = window.__store!.getState()
    return Object.values(state.worktreesByRepo)
      .flat()
      .find((entry) => entry.id === state.activeWorktreeId)!.path
  })
}

test('git blame beside the editor: authors, an uncommitted line, the commit on click', async ({
  orcaPage,
  registerPostElectronShutdownCleanup
}, testInfo) => {
  test.setTimeout(120_000)
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)
  const file = path.join(await worktreePath(orcaPage), 'src', 'index.ts')
  const committed = readFileSync(file, 'utf8')
  writeFileSync(file, `${committed}export const added = 1\n`)
  registerPostElectronShutdownCleanup(async () => writeFileSync(file, committed))

  const stopCapture = await startHiddenRendererFrameCapture(orcaPage)
  const shot = async (name: string) =>
    testInfo.attach(name, {
      body: await orcaPage.screenshot({ path: path.join(testInfo.outputDir, `${name}.png`) }),
      contentType: 'image/png'
    })
  try {
    await orcaPage.evaluate((filePath) => {
      const state = window.__store!.getState()
      state.openFile({
        filePath,
        relativePath: 'src/index.ts',
        worktreeId: state.activeWorktreeId!,
        language: 'typescript',
        mode: 'edit'
      })
    }, file)
    const editor = orcaPage
      .locator('.monaco-editor')
      .filter({ has: orcaPage.locator('.view-lines') })
      .first()
    await expect(editor.locator('.view-line').filter({ hasText: 'added' })).toBeVisible({
      timeout: 20_000
    })

    await editor.locator('.line-numbers').first().click({ button: 'right' })
    await orcaPage.getByRole('menuitem', { name: 'Git Blame' }).click()

    const committedRow = orcaPage.getByRole('button', { name: /^E2E Test/ })
    await expect(committedRow).toHaveCount(1, { timeout: 20_000 })
    await expect(orcaPage.getByText('Not committed', { exact: true })).toBeVisible()
    await committedRow.hover()
    await expect(orcaPage.getByText('Initial commit for E2E tests')).toBeVisible()
    await shot('editor-git-blame')

    await committedRow.click()
    await expect(orcaPage.locator('.monaco-diff-editor').first()).toBeVisible({ timeout: 20_000 })
    await shot('editor-git-blame-commit')
  } finally {
    await stopCapture()
  }
})
