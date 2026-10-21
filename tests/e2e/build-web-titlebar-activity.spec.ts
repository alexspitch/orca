/**
 * build-web's bell and task counter in Orca's titlebar: two icons with their numbers, the bell's
 * rows (opening marks them read, a row opens its task's card, Clear empties the list), the tasks
 * going now with a console job's live log, and the context menu that hides both.
 */

import path from 'node:path'
import type { Locator } from '@stablyai/playwright-test'
import { test, expect } from './helpers/orca-app'
import {
  startBuildWebConsoleMock,
  type BuildWebConsoleMock
} from './helpers/build-web-console-mock'
import {
  activityCalls,
  arriveNotification,
  resetActivityMock
} from './helpers/build-web-activity-mock'
import { startHiddenRendererFrameCapture } from './helpers/hidden-renderer-frame-capture'
import { waitForSessionReady } from './helpers/store'

let mock: BuildWebConsoleMock

test.beforeEach(async () => {
  mock = await startBuildWebConsoleMock()
  resetActivityMock()
})

test.afterEach(async () => {
  await mock.close()
})

test('titlebar: build-web notifications and tasks, each an icon with its number', async ({
  orcaPage
}, testInfo) => {
  test.setTimeout(120_000)
  await waitForSessionReady(orcaPage)
  const stopCapture = await startHiddenRendererFrameCapture(orcaPage)
  const shot = async (name: string) =>
    testInfo.attach(name, {
      body: await orcaPage.screenshot({ path: path.join(testInfo.outputDir, `${name}.png`) }),
      contentType: 'image/png'
    })
  // Not cut off at the right edge of the sidebar-wide header.
  const expectInsideHeader = async (target: Locator) => {
    const header = await orcaPage.locator('.titlebar-left').first().boundingBox()
    const box = await target.boundingBox()
    expect(header && box && box.x + box.width <= header.x + header.width).toBe(true)
  }
  try {
    const connected = await orcaPage.evaluate(async (baseUrl) => {
      const result = await window.api.buildWeb.connect({ baseUrl, token: 'bwt_e2e' })
      await window.__store?.getState().updateSettings({ showBuildWebButton: true })
      return result.ok
    }, mock.baseUrl)
    expect(connected).toBe(true)

    const group = orcaPage.getByRole('group', { name: 'build-web', exact: true })
    const bell = group.getByRole('button', { name: 'build-web notifications, 2 new' })
    const tasks = group.getByRole('button', { name: 'build-web tasks, 2 running' })
    await expect(bell).toBeVisible({ timeout: 15_000 })
    await expect(tasks).toBeVisible()
    await expectInsideHeader(tasks)
    await shot('titlebar-icons')

    await bell.click()
    const menu = orcaPage.getByRole('menu')
    await expect(menu.getByText('Image build failed: dc/ib-script-engine (rhel)')).toBeVisible()
    await expect(menu.getByText('Console error: Jira did not answer')).toBeVisible()
    // The log link is the card's to open, not a line of the body.
    await expect(menu.getByText('jenkins.test')).toHaveCount(0)
    await shot('bell-open')
    await expect.poll(() => activityCalls.includes('seen')).toBe(true)

    await menu.getByRole('menuitem', { name: /commented on IS-900/ }).click()
    await expect(orcaPage.getByText('The stand drops calls.')).toBeVisible({ timeout: 15_000 })
    await shot('bell-row-opens-card')
    await orcaPage.keyboard.press('Escape')
    // Opened is read: the number is gone, without waiting for the next reading.
    await expect(
      group.getByRole('button', { name: 'build-web notifications', exact: true })
    ).toBeVisible()
    // With the page history's arrows beside them, the header at its default width still holds all.
    await expectInsideHeader(tasks)
    await expectInsideHeader(
      orcaPage.getByRole('group', { name: 'Page history' }).getByRole('button').last()
    )
    await shot('titlebar-with-page-history')

    await tasks.click()
    await expect(menu.getByText('Nightly tests dc')).toBeVisible()
    await shot('tasks-open')
    await menu.getByRole('menuitem', { name: /Restart services on 3\.1 box DC/ }).click()
    const dialog = orcaPage.getByRole('dialog', { name: 'Restart services on 3.1 box DC' })
    await expect(dialog.getByText('::phase:: compose')).toBeVisible({ timeout: 15_000 })
    await shot('task-log')
    await orcaPage.keyboard.press('Escape')
    await expect(dialog).toBeHidden()

    await group.getByRole('button', { name: /^build-web notifications/ }).click()
    await menu.getByRole('menuitem', { name: 'Clear' }).click()
    await expect.poll(() => activityCalls.includes('clear')).toBe(true)
    await group.getByRole('button', { name: /^build-web notifications/ }).click()
    await expect(menu.getByText('No notifications')).toBeVisible()
    await orcaPage.keyboard.press('Escape')

    await group.click({ button: 'right', position: { x: 2, y: 2 } })
    await orcaPage.getByRole('menuitem', { name: 'Hide from titlebar' }).click()
    await expect(group).toBeHidden()
  } finally {
    await stopCapture()
  }
})

test('a new build-web notification shows as a toast while Orca is in front', async ({
  orcaPage
}, testInfo) => {
  test.setTimeout(120_000)
  await waitForSessionReady(orcaPage)
  const stopCapture = await startHiddenRendererFrameCapture(orcaPage)
  try {
    await orcaPage.evaluate(async (baseUrl) => {
      await window.api.buildWeb.connect({ baseUrl, token: 'bwt_e2e' })
      await window.__store?.getState().updateSettings({ showBuildWebButton: true })
    }, mock.baseUrl)
    // What was there at the first reading is the bell's to show, not news.
    await expect(
      orcaPage.getByRole('button', { name: 'build-web notifications, 2 new' })
    ).toBeVisible({ timeout: 15_000 })
    await expect(orcaPage.getByText('Image build failed: dc/ib-script-engine (rhel)')).toHaveCount(
      0
    )

    arriveNotification('n-new', 'qa@box.test moved IS-900 to Testing')
    // Why: the test window is never in front; a build-web page opening reads the bell at once.
    await orcaPage.evaluate(() => {
      document.hasFocus = () => true
      window.__store?.getState().openBuildWebStandsPage()
    })
    const toast = orcaPage.locator('[data-sonner-toast]').filter({
      hasText: 'qa@box.test moved IS-900 to Testing'
    })
    await expect(toast).toBeVisible({ timeout: 15_000 })
    await expect(toast).toContainText('IS-900 · Please retest on the stand.')
    await testInfo.attach('toast', {
      body: await orcaPage.screenshot({ path: path.join(testInfo.outputDir, 'toast.png') }),
      contentType: 'image/png'
    })
    await toast.getByRole('button', { name: 'Open' }).click()
    await expect(orcaPage.getByText('The stand drops calls.')).toBeVisible({ timeout: 15_000 })
  } finally {
    await stopCapture()
  }
})
