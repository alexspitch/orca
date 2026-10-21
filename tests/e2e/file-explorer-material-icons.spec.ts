/**
 * The Explorer draws the Material Icon Theme's icons once it is chosen in Settings, and Orca's
 * own again when it is switched back.
 */

import path from 'node:path'
import type { Locator, Page } from '@stablyai/playwright-test'
import { test, expect } from './helpers/orca-app'
import { openFileExplorer } from './helpers/file-explorer'
import { waitForActiveWorktree, waitForSessionReady } from './helpers/store'

function rowByName(explorer: Locator, page: Page, name: string): Locator {
  return explorer
    .locator('[data-file-explorer-row]')
    .filter({ has: page.locator('[data-file-explorer-row-name]', { hasText: name }) })
    .first()
}

const setFileIcons = (page: Page, theme: 'orca' | 'material') =>
  page.evaluate(async (fileIconTheme) => {
    await window.__store?.getState().updateSettings({ fileIconTheme })
  }, theme)

test('Explorer: Material Icon Theme icons, chosen in Settings', async ({ orcaPage }, testInfo) => {
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)
  await openFileExplorer(orcaPage)
  const explorer = orcaPage.locator('[data-orca-explorer-shell]')
  await expect(rowByName(explorer, orcaPage, 'package.json')).toBeVisible({ timeout: 10_000 })
  await expect(explorer.locator('[data-file-explorer-row] img')).toHaveCount(0)

  await setFileIcons(orcaPage, 'material')
  const packageIcon = rowByName(explorer, orcaPage, 'package.json').locator('img')
  await expect(packageIcon).toHaveAttribute('src', /nodejs.*\.svg/, { timeout: 15_000 })
  await expect(rowByName(explorer, orcaPage, 'README.md').locator('img')).toHaveAttribute(
    'src',
    /readme.*\.svg/
  )
  await expect(rowByName(explorer, orcaPage, 'src').locator('img')).toHaveAttribute(
    'src',
    /folder-src.*\.svg/
  )
  // The icon is a real image, not a broken link.
  await expect
    .poll(() => packageIcon.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0)
  await testInfo.attach('material-icons', {
    body: await orcaPage.screenshot({ path: path.join(testInfo.outputDir, 'material-icons.png') }),
    contentType: 'image/png'
  })

  await setFileIcons(orcaPage, 'orca')
  await expect(explorer.locator('[data-file-explorer-row] img')).toHaveCount(0)
})
