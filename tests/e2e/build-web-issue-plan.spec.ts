/**
 * A task's plan and mockups against a build-web console on loopback, as build-web's card shows
 * them: the plan drawn with how far it has got, and each mockup — an archive of pages or a single
 * page — framed in the card from the console's token address, screen by screen.
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

test('a task card: the plan with its progress, and the mockups framed screen by screen', async ({
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

    await orcaPage.getByRole('button', { name: 'Open IS-901 full screen' }).click()
    // The plan is read with the card, so its tab already says how far it has got.
    const planTab = orcaPage.getByRole('tab', { name: 'Plan 1 / 2' })
    await expect(planTab).toBeVisible({ timeout: 15_000 })
    await planTab.click()
    await expect(planTab).toHaveAttribute('aria-selected', 'true')
    await expect(orcaPage.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'false'
    )
    await expect(orcaPage.getByRole('heading', { name: 'Plan of the fix' })).toBeVisible()
    await expect(orcaPage.getByText('1 of 2 done')).toBeVisible()
    await shot('issue-plan')

    await orcaPage.getByRole('tab', { name: 'Mockups 2' }).click()
    // The newest mockup first: the archive, on its first page, with its own stylesheet.
    const frame = orcaPage.frameLocator('iframe[title="index.html"]')
    await expect(frame.getByRole('heading', { name: 'Mockup home screen' })).toBeVisible({
      timeout: 15_000
    })
    await expect(frame.locator('#home')).toHaveCSS('color', 'rgb(200, 0, 0)')
    await shot('issue-mockup-archive')

    const list = orcaPage.getByRole('navigation', { name: 'Mockups and screens' })
    await list.getByRole('button', { name: 'settings.html' }).click()
    await expect(
      orcaPage
        .frameLocator('iframe[title="pages/settings.html"]')
        .getByRole('heading', { name: 'Mockup settings screen' })
    ).toBeVisible()

    await list.getByRole('button', { name: 'login.html' }).click()
    await expect(
      orcaPage
        .frameLocator('iframe[title="login.html"]')
        .getByRole('heading', { name: 'Mockup login page' })
    ).toBeVisible({ timeout: 15_000 })
    await shot('issue-mockup-page')
  } finally {
    await stopCapture()
  }
})
