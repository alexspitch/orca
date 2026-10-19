/**
 * Recaps as a month's calendar against a build-web console on loopback: the reports on the days
 * they finished, a report opened over the calendar and closed back to it, months stepped through,
 * and the list view still one click away.
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

test('recaps as a calendar: reports by day, one opened and closed, months stepped', async ({
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

    const months = await orcaPage.evaluate(() => {
      const now = new Date()
      const title = (d: Date) => d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      return {
        current: title(new Date(now.getFullYear(), now.getMonth(), 1)),
        previous: title(new Date(now.getFullYear(), now.getMonth() - 1, 1))
      }
    })
    await expect(orcaPage.getByRole('heading', { name: months.current })).toBeVisible()
    const nightly = orcaPage.getByRole('button', { name: /Nightly review/ })
    await expect(nightly).toHaveCount(2)
    await expect(orcaPage.getByRole('button', { name: /Weekly SA/ })).toBeVisible()
    await shot('recaps-calendar')

    await nightly.first().click()
    await expect(orcaPage.getByRole('button', { name: 'Calendar', exact: true })).toBeVisible()
    await expect(
      orcaPage.frameLocator('iframe[title="Nightly review"]').getByText('Report r-night-3')
    ).toBeVisible()
    await shot('recaps-report')
    await orcaPage.keyboard.press('Escape')
    await expect(orcaPage.getByRole('heading', { name: months.current })).toBeVisible()
    await expect(orcaPage.getByRole('heading', { name: 'Recaps' })).toBeVisible()

    await orcaPage.getByRole('button', { name: 'Previous month' }).click()
    await expect(orcaPage.getByRole('heading', { name: months.previous })).toBeVisible()
    await expect(orcaPage.getByRole('button', { name: /Old report/ })).toBeVisible()
    await expect(nightly).toHaveCount(0)
    await orcaPage.getByRole('button', { name: 'This month' }).click()
    await expect(nightly).toHaveCount(2)

    await orcaPage.getByRole('radio', { name: 'List' }).click()
    await expect(orcaPage.getByText('Reports: 4')).toBeVisible()
  } finally {
    await stopCapture()
  }
})
