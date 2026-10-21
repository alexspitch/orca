/**
 * Issues against a build-web console on loopback: a task's title opens its full card as a tab,
 * tabs switch and close like editor tabs, and the task's number opens the side panel instead.
 */

import path from 'node:path'
import { test, expect } from './helpers/orca-app'
import {
  startBuildWebConsoleMock,
  type BuildWebConsoleMock
} from './helpers/build-web-console-mock'
import { startHiddenRendererFrameCapture } from './helpers/hidden-renderer-frame-capture'
import { waitForSessionReady } from './helpers/store'

let mock: BuildWebConsoleMock

test.beforeEach(async () => {
  mock = await startBuildWebConsoleMock()
})

test.afterEach(async () => {
  await mock.close()
})

test('Issues: titles open cards as tabs, numbers open the side panel', async ({
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
  try {
    const connected = await orcaPage.evaluate(async (baseUrl) => {
      const result = await window.api.buildWeb.connect({ baseUrl, token: 'bwt_e2e' })
      window.__store?.getState().openBuildWebPage()
      return result.ok
    }, mock.baseUrl)
    expect(connected).toBe(true)

    const tabs = orcaPage.getByRole('tablist', { name: 'Open tasks' })
    await orcaPage.getByRole('button', { name: 'Attachments demo', exact: true }).click()
    await expect(orcaPage.getByRole('heading', { name: 'Attachments demo' })).toBeVisible({
      timeout: 15_000
    })
    await expect(tabs.getByRole('tab')).toHaveText(['List', /IS-900\s*Attachments demo/])

    await tabs.getByRole('tab', { name: 'List' }).click()
    await orcaPage.getByRole('button', { name: 'Plan and mockups demo', exact: true }).click()
    await expect(orcaPage.getByRole('heading', { name: 'Plan and mockups demo' })).toBeVisible({
      timeout: 15_000
    })
    await expect(tabs.getByRole('tab')).toHaveText([
      'List',
      /IS-900\s*Attachments demo/,
      /IS-901\s*Plan and mockups demo/
    ])
    await expect(tabs.getByRole('tab', { name: /IS-901/ })).toHaveAttribute('aria-selected', 'true')
    await shot('task-tabs')

    await tabs.getByRole('tab', { name: /IS-900/ }).click()
    await expect(orcaPage.getByRole('heading', { name: 'Attachments demo' })).toBeVisible()
    // Closing the tab on show moves to its right-hand neighbour.
    await tabs
      .getByRole('tab', { name: /IS-900/ })
      .getByRole('button', { name: 'Close tab' })
      .click()
    await expect(orcaPage.getByRole('heading', { name: 'Plan and mockups demo' })).toBeVisible()
    await expect(tabs.getByRole('tab')).toHaveText(['List', /IS-901\s*Plan and mockups demo/])

    await tabs.getByRole('tab', { name: 'List' }).click()
    await orcaPage.getByRole('button', { name: 'IS-900', exact: true }).click()
    await expect(orcaPage.getByRole('dialog')).toContainText('Attachments demo', {
      timeout: 15_000
    })
    await shot('side-panel-from-number')
    // The side panel is a peek, not a tab; while it is open it hides the page from the a11y tree.
    await orcaPage.keyboard.press('Escape')
    await expect(orcaPage.getByRole('dialog')).toHaveCount(0)
    await expect(tabs.getByRole('tab')).toHaveText(['List', /IS-901\s*Plan and mockups demo/])
  } finally {
    await stopCapture()
  }
})
