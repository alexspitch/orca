import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test } from './helpers/orca-app'
import { launchHeadlessPairedRuntimeHost } from './helpers/headless-paired-runtime-host'
import { launchPairedWebClient, type PairedWebClient } from './helpers/paired-electron-client'
import {
  CONSOLE_TOKEN,
  CONSOLE_URL,
  SESSION_POLL_MS,
  connectTaskHost,
  createTask,
  makeTaskRepository,
  moveTask,
  takeTaskToWork,
  taskSessionState
} from './helpers/build-web-task-session-fixture'

// IS-147: the host's task states reach a paired client's sidebar — «By task» over a hundred rows,
// the compact rows with their states, attention first, «Awaiting release» folded by default.

test.skip(
  !CONSOLE_URL || !CONSOLE_TOKEN,
  'needs ORCA_E2E_BUILD_WEB_URL and ORCA_E2E_BUILD_WEB_TOKEN'
)
test.skip(process.platform === 'win32', 'the scratch repository is made with a POSIX shell')

const PLAIN_ROWS = 95
const SHOT_DIR = process.env.ORCA_E2E_SHOT_DIR

// oxlint-disable-next-line no-empty-pattern -- Playwright fixture callbacks require object destructuring here.
test('«By task» groups a hundred rows by their task state on a paired client', async ({}, testInfo) => {
  test.setTimeout(420_000)
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'orca-e2e-build-web-sidebar-'))
  const host = await launchHeadlessPairedRuntimeHost({
    extraEnv: { ORCA_BUILD_WEB_SESSION_POLL_MS: String(SESSION_POLL_MS) }
  })
  let client: PairedWebClient | null = null
  try {
    const work = makeTaskRepository(scratch)
    const repoId = await connectTaskHost(host, work)
    const poll = { timeout: 60_000, intervals: [SESSION_POLL_MS] }

    const active = await takeTaskToWork(host, repoId, await createTask('Sidebar: active'), 'tab-a')
    const waitingTask = await createTask('Sidebar: awaiting release')
    const waiting = await takeTaskToWork(host, repoId, waitingTask, 'tab-w')
    const dirtyTask = await createTask('Sidebar: needs attention')
    const dirty = await takeTaskToWork(host, repoId, dirtyTask, 'tab-d')
    writeFileSync(path.join(dirty.path, 'notes.txt'), 'left behind\n')
    await moveTask(waitingTask.id, 'testing')
    await moveTask(dirtyTask.id, 'wontfix')
    for (let i = 0; i < PLAIN_ROWS; i += 1) {
      await host.client.call('worktree.create', {
        repo: `id:${repoId}`,
        name: `plain-${String(i).padStart(2, '0')}`
      })
    }
    await expect.poll(() => taskSessionState(host, active.worktreeId), poll).toBe('active')
    await expect.poll(() => taskSessionState(host, waiting.worktreeId), poll).toBe('waiting')
    await expect.poll(() => taskSessionState(host, dirty.worktreeId), poll).toBe('attention:dirty')

    client = await launchPairedWebClient(host.app, host.offer)
    const page = client.page
    await expect
      .poll(() => page.evaluate(() => window.__store?.getState().allWorktrees().length ?? 0), poll)
      .toBeGreaterThanOrEqual(PLAIN_ROWS + 3)
    await page.evaluate(async () => {
      const state = window.__store?.getState()
      await state?.updateSettings({
        compactWorktreeCards: true,
        experimentalNewWorktreeCardStyle: false
      })
      state?.setGroupBy('task')
    })

    const sidebar = page.locator('[data-worktree-sidebar]')
    for (const header of ['Needs attention', 'Awaiting release', 'In progress', 'No task']) {
      await expect(sidebar.getByText(header, { exact: true }).first()).toBeVisible()
    }
    // Attention comes first, its reason under the row; the folded release group hides its row.
    await expect(sidebar.locator('[data-worktree-task-attention-reason]').first()).toBeVisible()
    await expect(sidebar.getByText('Sidebar: needs attention').first()).toBeVisible()
    await expect(sidebar.locator('[data-worktree-task-session="waiting"]')).toHaveCount(0)
    const headers = await sidebar
      .getByText(/^(Needs attention|Awaiting release|In progress|No task)$/)
      .allTextContents()
    expect(headers.indexOf('Needs attention')).toBe(0)

    const shoot = async (name: string) => {
      const file = testInfo.outputPath(`${name}.png`)
      await sidebar.screenshot({ path: file })
      if (SHOT_DIR) {
        mkdirSync(SHOT_DIR, { recursive: true })
        await sidebar.screenshot({ path: path.join(SHOT_DIR, `${name}.png`) })
      }
    }
    await shoot('by-task-compact')

    await sidebar.getByText('Awaiting release', { exact: true }).first().click()
    await expect(sidebar.locator('[data-worktree-task-session="waiting"]').first()).toBeVisible()
    await shoot('by-task-compact-release-open')

    // Elsewhere the row keeps its place, and a counter beside the filter leads back to «By task».
    await page.evaluate(() => window.__store?.getState().setGroupBy('repo'))
    const counter = page.getByRole('button', { name: /1 workspaces need attention/ })
    await expect(counter).toBeVisible()
    await shoot('by-project-attention-counter')
    await counter.click()
    await expect.poll(() => page.evaluate(() => window.__store?.getState().groupBy)).toBe('task')
  } finally {
    await client?.dispose()
    await host.dispose()
    rmSync(scratch, { recursive: true, force: true })
  }
})
