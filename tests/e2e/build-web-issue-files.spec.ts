/**
 * A task's attachments against a build-web console on loopback: the task's own files on its card,
 * a comment's under that comment; Markdown and HTML open in tabs of the worktree, a log in a
 * read-only tab, and a file too large for a tab is offered in the browser.
 */

import path from 'node:path'
import type { Page } from '@stablyai/playwright-test'
import { test, expect } from './helpers/orca-app'
import {
  startBuildWebConsoleMock,
  type BuildWebConsoleMock
} from './helpers/build-web-console-mock'
import { startHiddenRendererFrameCapture } from './helpers/hidden-renderer-frame-capture'
import { waitForActiveWorktree, waitForSessionReady } from './helpers/store'

let mock: BuildWebConsoleMock

test.beforeEach(async () => {
  mock = await startBuildWebConsoleMock()
})

test.afterEach(async () => {
  await mock.close()
})

async function openTaskCard(page: Page): Promise<void> {
  await page.evaluate(() => window.__store?.getState().openBuildWebPage())
  await page.getByRole('button', { name: 'Attachments demo' }).click()
  await expect(page.getByText('Attachments 4')).toBeVisible({ timeout: 15_000 })
}

const fileButton = (page: Page, name: string) =>
  page.getByRole('list', { name: 'Attachments' }).getByRole('button', { name: new RegExp(name) })

test('task attachments: listed on the card and its comments, opened in worktree tabs', async ({
  orcaPage
}, testInfo) => {
  test.setTimeout(120_000)
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)
  const stopCapture = await startHiddenRendererFrameCapture(orcaPage)
  const shot = async (name: string) =>
    testInfo.attach(name, {
      body: await orcaPage.screenshot({ path: path.join(testInfo.outputDir, `${name}.png`) }),
      contentType: 'image/png'
    })
  try {
    const connected = await orcaPage.evaluate(async (baseUrl) => {
      const result = await window.api.buildWeb.connect({ baseUrl, token: 'bwt_e2e' })
      return result.ok
    }, mock.baseUrl)
    expect(connected).toBe(true)

    await openTaskCard(orcaPage)
    for (const name of ['notes.md', 'report.html', 'shot.png', 'call.mp4', 'run.log']) {
      await expect(fileButton(orcaPage, name)).toBeVisible()
    }
    // The log was said with the comment, so it sits under it, not among the task's files.
    const comment = orcaPage.locator('li').filter({ hasText: 'The log of the failed call.' })
    await expect(comment.getByRole('button', { name: /run\.log/ })).toBeVisible()
    await shot('task-attachments')

    await fileButton(orcaPage, 'notes.md').click()
    await expect(orcaPage.getByText('Notes from the attachment')).toBeVisible({ timeout: 20_000 })
    await shot('markdown-attachment-tab')

    // Back returns from the file's tab to the card it was opened from.
    await orcaPage.getByRole('button', { name: 'Go back', exact: true }).click()
    await expect(orcaPage.getByText('Attachments 4')).toBeVisible({ timeout: 15_000 })
    await shot('back-to-task-card')
    await fileButton(orcaPage, 'run.log').click()
    await expect(
      orcaPage.locator('.monaco-editor .view-line').filter({ hasText: 'engine timeout' })
    ).toBeVisible({ timeout: 20_000 })

    await openTaskCard(orcaPage)
    await fileButton(orcaPage, 'report.html').click()
    await expect
      .poll(
        () =>
          orcaPage.evaluate(() => {
            const state = window.__store!.getState()
            return (state.unifiedTabsByWorktree[state.activeWorktreeId!] ?? []).some(
              (tab) => tab.contentType === 'browser' && /report\.html/.test(tab.label ?? '')
            )
          }),
        { timeout: 20_000 }
      )
      .toBe(true)
    // The page itself loaded from this computer: its own <title> replaces the file name.
    await expect
      .poll(
        () =>
          orcaPage.evaluate(() => {
            const state = window.__store!.getState()
            return Object.values(state.browserPagesByWorkspace)
              .flat()
              .some((page) => page.url.endsWith('report.html') && page.title === 'report')
          }),
        { timeout: 20_000 }
      )
      .toBe(true)
    await shot('html-attachment-tab')
  } finally {
    await stopCapture()
  }
})
