/**
 * Orca's page history against a build-web console on loopback: a task number in a recap report
 * opens the task's card, Back returns to that same report and Forward to the card again, and the
 * last pages are listed to jump to — apart from the workspace Back/Forward.
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

test('page history: a report’s task number opens the card, Back returns to the report', async ({
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
      window.__store?.getState().openBuildWebRecapsPage()
      return result.ok
    }, mock.baseUrl)
    expect(connected).toBe(true)

    await orcaPage
      .getByRole('button', { name: /Nightly review/ })
      .first()
      .click()
    const report = orcaPage.frameLocator('iframe[title="Nightly review"]')
    await expect(report.getByText('Report r-night-3')).toBeVisible()
    // The type is a coloured chip, the number a link.
    await expect(report.locator('.orca-type-bug')).toHaveText('bug')
    await shot('recap-report-links')
    await report.getByRole('link', { name: 'IS-901', exact: true }).click()

    await expect(orcaPage.getByRole('heading', { name: 'Plan and mockups demo' })).toBeVisible({
      timeout: 15_000
    })
    const history = orcaPage.getByRole('group', { name: 'Page history' })
    const back = history.getByRole('button', { name: /^Back to Recaps · Nightly review/ })
    await expect(back).toBeEnabled()
    await shot('task-from-report')

    await back.click()
    await expect(
      orcaPage.frameLocator('iframe[title="Nightly review"]').getByText('Report r-night-3')
    ).toBeVisible({ timeout: 15_000 })
    await history
      .getByRole('button', { name: /^Forward to IS-901 · Plan and mockups demo/ })
      .click()
    await expect(orcaPage.getByRole('heading', { name: 'Plan and mockups demo' })).toBeVisible()

    await history.getByRole('button', { name: 'Recent pages' }).click()
    const menu = orcaPage.getByRole('menu')
    await expect(menu.getByRole('menuitem')).toHaveText([
      'IS-901 · Plan and mockups demo',
      /^Recaps · Nightly review/,
      'Recaps'
    ])
    await shot('recent-pages')
    await menu.getByRole('menuitem', { name: /^Recaps · Nightly review/ }).click()

    // A subtask's number opens the subtask's own card.
    await orcaPage
      .frameLocator('iframe[title="Nightly review"]')
      .getByRole('link', { name: 'IS-901.1', exact: true })
      .click()
    await expect(orcaPage.getByRole('heading', { name: 'Subtask demo' })).toBeVisible({
      timeout: 15_000
    })
    await shot('subtask-from-report')
  } finally {
    await stopCapture()
  }
})
