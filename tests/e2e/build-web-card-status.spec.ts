/**
 * A task's status is changed in its card, in the drawer and full screen alike: the status chip is
 * a picker of every status, as in the list's row.
 */

import path from 'node:path'
import { test, expect } from './helpers/orca-app'
import {
  startBuildWebConsoleMock,
  type BuildWebConsoleMock
} from './helpers/build-web-console-mock'
import { issuePatches, resetIssuePatches } from './helpers/build-web-issues-mock'
import { startHiddenRendererFrameCapture } from './helpers/hidden-renderer-frame-capture'
import { waitForSessionReady } from './helpers/store'

let mock: BuildWebConsoleMock

test.beforeEach(async () => {
  mock = await startBuildWebConsoleMock()
  resetIssuePatches()
})

test.afterEach(async () => {
  await mock.close()
})

test('card: the status chip changes the task’s status', async ({ orcaPage }, testInfo) => {
  test.setTimeout(120_000)
  await waitForSessionReady(orcaPage)
  const stopCapture = await startHiddenRendererFrameCapture(orcaPage)
  const shot = async (name: string) =>
    testInfo.attach(name, {
      body: await orcaPage.screenshot({ path: path.join(testInfo.outputDir, `${name}.png`) }),
      contentType: 'image/png'
    })
  try {
    await orcaPage.evaluate(async (baseUrl) => {
      await window.api.buildWeb.connect({ baseUrl, token: 'bwt_e2e' })
      window.__store?.getState().openBuildWebPage()
    }, mock.baseUrl)
    // The title opens the card full screen.
    await orcaPage.getByText('Attachments demo').click()
    const picker = orcaPage.getByRole('button', { name: 'Change the status of IS-900' })
    await expect(picker).toContainText('To do', { timeout: 15_000 })
    await picker.click()
    await shot('full-screen-status-menu')
    await orcaPage.getByRole('menuitem', { name: 'In progress' }).click()
    await expect.poll(() => issuePatches).toEqual([{ status: 'inprogress' }])
    await expect(picker).toContainText('In progress')

    // The key opens the same card in the side panel.
    await orcaPage.getByRole('button', { name: 'Collapse' }).click()
    await orcaPage.getByRole('button', { name: 'IS-900', exact: true }).click()
    const drawer = orcaPage.getByRole('dialog')
    const drawerPicker = drawer.getByRole('button', { name: 'Change the status of IS-900' })
    await expect(drawerPicker).toContainText('In progress', { timeout: 15_000 })
    await drawerPicker.click()
    await orcaPage.getByRole('menuitem', { name: 'Testing', exact: true }).click()
    await expect.poll(() => issuePatches.at(-1)).toEqual({ status: 'testing' })
    await expect(drawerPicker).toContainText('Testing')
    await shot('drawer-status')
  } finally {
    await stopCapture()
  }
})
