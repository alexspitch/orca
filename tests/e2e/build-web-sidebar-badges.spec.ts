/**
 * The numbers on the sidebar's build-web items say what they count on hover, and the Issues number
 * counts open blockers only, within the Issues filters — a closed blocker never, whatever the list shows.
 */

import path from 'node:path'
import { test, expect } from './helpers/orca-app'
import {
  startBuildWebConsoleMock,
  type BuildWebConsoleMock
} from './helpers/build-web-console-mock'
import { blockerQueries } from './helpers/build-web-issues-mock'
import { startHiddenRendererFrameCapture } from './helpers/hidden-renderer-frame-capture'
import { waitForSessionReady } from './helpers/store'

let mock: BuildWebConsoleMock

test.beforeEach(async () => {
  mock = await startBuildWebConsoleMock()
  blockerQueries.length = 0
})

test.afterEach(async () => {
  await mock.close()
})

test('sidebar badges: what each number counts, and open blockers only', async ({
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
      await window.__store
        ?.getState()
        .updateSettings({ showBuildWebButton: true, showBuildWebImagesButton: true })
      window.__store?.getState().openBuildWebPage()
      return result.ok
    }, mock.baseUrl)
    expect(connected).toBe(true)

    const issues = orcaPage.getByRole('button', { name: /^Issues, \d+\+? blockers$/ })
    await expect(issues).toHaveAccessibleName('Issues, 1 blockers', { timeout: 15_000 })
    await issues.locator('span[aria-hidden="true"]').last().hover()
    // Why filtered: an onboarding tooltip of the sidebar may be showing too.
    await expect(
      orcaPage
        .getByRole('tooltip')
        .filter({ hasText: 'Blockers: open tasks at the highest priority' })
    ).toBeVisible()
    await shot('issues-badge-hint')

    // Only a closed status on the page: its blocker blocks nothing, so the badge goes, unasked.
    const asked = blockerQueries.length
    const statusFilter = orcaPage.locator('button[aria-label="Status"]')
    await statusFilter.click()
    await orcaPage.getByRole('menuitem', { name: 'Any status' }).click()
    await expect(orcaPage.getByRole('menu')).toBeHidden()
    await statusFilter.click()
    await orcaPage.getByRole('menuitemcheckbox', { name: 'Done' }).click()
    await orcaPage.keyboard.press('Escape')
    await expect(orcaPage.getByRole('button', { name: 'Issues', exact: true })).toBeVisible({
      timeout: 15_000
    })
    expect(blockerQueries.slice(asked).join(',')).not.toContain('done')

    const images = orcaPage.getByRole('button', { name: /^Images, \d+ failed$/ })
    await expect(images).toBeVisible({ timeout: 15_000 })
    await images.locator('span[aria-hidden="true"]').last().hover()
    await expect(
      orcaPage.getByRole('tooltip').filter({ hasText: 'Images whose last build failed' })
    ).toBeVisible()
    await shot('images-badge-hint')
  } finally {
    await stopCapture()
  }
})
