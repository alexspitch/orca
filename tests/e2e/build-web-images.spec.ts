/**
 * The Images page against a build-web console on loopback: any built image can be picked, pushed
 * or not, and «Copy links» names each by its own build tag; a failed build offers no box, and its
 * «failed» settles it with the last success of its version.
 */

import path from 'node:path'
import { test, expect } from './helpers/orca-app'
import {
  startBuildWebConsoleMock,
  type BuildWebConsoleMock
} from './helpers/build-web-console-mock'
import { IMAGE_REFS } from './helpers/build-web-images-mock'
import { startHiddenRendererFrameCapture } from './helpers/hidden-renderer-frame-capture'
import { waitForSessionReady } from './helpers/store'

let mock: BuildWebConsoleMock

test.beforeEach(async () => {
  // `build`: settling a failed image is New build's right on the console.
  mock = await startBuildWebConsoleMock({ perms: ['stands', 'tests', 'build'] })
})

test.afterEach(async () => {
  await mock.close()
})

test('images: pick built images and copy their links with the build number', async ({
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
      await window.__store?.getState().updateSettings({ showBuildWebImagesButton: true })
      window.__store?.getState().openBuildWebImagesPage()
      return result.ok
    }, mock.baseUrl)
    expect(connected).toBe(true)

    // Why not clicked: the copy would land on the desktop's clipboard; its title lists the same links.
    const copy = orcaPage.getByRole('button', { name: /^Copy links/ })
    await expect(orcaPage.getByRole('checkbox', { name: 'Pick dc/dc-backend' })).toBeVisible()
    await expect(orcaPage.getByRole('checkbox', { name: 'Pick sa/sa-backend' })).toHaveCount(0)
    await expect(copy).toBeDisabled()

    await orcaPage.getByRole('checkbox', { name: 'Pick dc/dc-backend' }).click()
    await orcaPage.getByRole('checkbox', { name: 'Pick dc/dc-ui' }).click()
    await expect(copy).toHaveText('Copy links (2)')
    await expect(copy).toBeEnabled()
    await expect(copy).toHaveAttribute('title', `${IMAGE_REFS.backend}\n${IMAGE_REFS.ui}`)
    // Only the build never pushed goes to the registry; the pushed one is picked for its link.
    await expect(orcaPage.getByRole('button', { name: 'Push to registry (1)' })).toBeVisible()
    await shot('images-picked')

    await orcaPage.getByRole('button', { name: 'dc/dc-backend', exact: true }).click()
    await orcaPage.getByRole('checkbox', { name: 'Pick 3.6b411' }).click()
    await expect(copy).toHaveText('Copy links (1)')
    await expect(copy).toBeEnabled()
    await expect(copy).toHaveAttribute('title', IMAGE_REFS.backendOlder)
    await shot('image-history-picked')
  } finally {
    await stopCapture()
  }
})

test('images: «failed» settles the image with its last successful build', async ({
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
      await window.__store?.getState().updateSettings({ showBuildWebImagesButton: true })
      window.__store?.getState().openBuildWebImagesPage()
      return result.ok
    }, mock.baseUrl)
    expect(connected).toBe(true)

    const failedBadge = orcaPage.getByRole('button', { name: /^Images, \d+ failed$/ })
    await expect(failedBadge).toHaveCount(1)
    const row = orcaPage.getByRole('row').filter({ hasText: 'sa/sa-backend' })
    await row.getByRole('button', { name: 'failed' }).click()
    await expect(orcaPage.getByText('Use build #54 of sa/sa-backend?')).toBeVisible()
    await shot('settle-confirm')
    await orcaPage.getByRole('button', { name: 'Use #54' }).click()

    await expect
      .poll(() => mock.adoptions)
      .toEqual([{ image: 'sa/sa-backend', dist: 'rhel', number: 55, to: 54 }])
    // The table is read again: the success is the newest build, with an image to pick.
    await expect(row.getByText('success')).toBeVisible({ timeout: 15_000 })
    await expect(orcaPage.getByRole('checkbox', { name: 'Pick sa/sa-backend' })).toBeVisible()
    // The sidebar's failed count follows at once.
    await expect(failedBadge).toHaveCount(0)
    await shot('settled')
  } finally {
    await stopCapture()
  }
})
