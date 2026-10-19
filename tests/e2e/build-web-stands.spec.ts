/**
 * The Stands page against a build-web console on loopback: the sidebar group, a stand's services
 * with their build numbers, a followed log with find, a restart and an up -d, and a login that
 * fills the stand portal's form without the password ever reaching the window.
 */

import path from 'node:path'
import { test, expect } from './helpers/orca-app'
import {
  startBuildWebConsoleMock,
  type BuildWebConsoleMock
} from './helpers/build-web-console-mock'
import { startHiddenRendererFrameCapture } from './helpers/hidden-renderer-frame-capture'
import { getBrowserTabs, waitForActiveWorktree, waitForSessionReady } from './helpers/store'

let mock: BuildWebConsoleMock

test.beforeEach(async () => {
  mock = await startBuildWebConsoleMock()
})

test.afterEach(async () => {
  await mock.close()
})

test('a stand: services, a followed log, operations and a login', async ({
  orcaPage
}, testInfo) => {
  test.setTimeout(180_000)
  await waitForSessionReady(orcaPage)
  const worktreeId = await waitForActiveWorktree(orcaPage)
  const stopCapture = await startHiddenRendererFrameCapture(orcaPage)
  const shot = async (name: string) =>
    testInfo.attach(name, {
      body: await orcaPage.screenshot({
        path: path.join(testInfo.outputDir, `${name}.png`)
      }),
      contentType: 'image/png'
    })
  try {
    const connected = await orcaPage.evaluate(async (baseUrl) => {
      const result = await window.api.buildWeb.connect({ baseUrl, token: 'bwt_e2e' })
      await window.__store?.getState().updateSettings({ showBuildWebStandsButton: true })
      return result.ok
    }, mock.baseUrl)
    expect(connected).toBe(true)

    await orcaPage.getByRole('button', { name: 'Show stands' }).click()
    await orcaPage.getByRole('button', { name: '3.1 box', exact: true }).click()
    await expect(orcaPage.getByRole('heading', { name: '3.1 box' })).toBeVisible()
    await expect(orcaPage.getByText('#11830')).toBeVisible()
    await expect(orcaPage.getByText('running · healthy')).toBeVisible()
    await shot('stand-services')

    await orcaPage
      .getByRole('row', { name: /ib-script-engine/ })
      .getByRole('button', { name: 'Log' })
      .click()
    await expect(orcaPage.getByText('tick 2')).toBeVisible({ timeout: 15_000 })
    expect(mock.openLogStreams()).toBe(1)
    await orcaPage.getByRole('button', { name: 'Find in log' }).click()
    await orcaPage.getByRole('textbox', { name: 'Find in log' }).fill('error')
    await expect(orcaPage.getByRole('search').getByText('3/3')).toBeVisible()
    await shot('stand-log')
    await orcaPage.getByRole('button', { name: 'Close the log' }).click()
    await expect.poll(() => mock.openLogStreams(), { timeout: 15_000 }).toBe(0)

    await orcaPage
      .getByRole('row', { name: /kb-external-mock/ })
      .getByRole('button', { name: 'Restart' })
      .click()
    await orcaPage.getByRole('dialog').getByRole('button', { name: 'Restart' }).click()
    await expect
      .poll(() => mock.ops)
      .toEqual([{ standId: 'c-dc', kind: 'restart', services: ['kb-external-mock'] }])
    await expect(orcaPage.getByText('success')).toBeVisible({ timeout: 15_000 })
    await orcaPage.getByRole('button', { name: 'docker compose up -d' }).click()
    await orcaPage.getByRole('dialog').getByRole('button', { name: 'Run up -d' }).click()
    await expect.poll(() => mock.ops.at(-1)).toEqual({ standId: 'c-dc', kind: 'up', services: [] })

    await orcaPage.getByRole('tab', { name: 'Users' }).click()
    await expect(orcaPage.getByRole('tab', { name: 'Users' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await expect(orcaPage.getByText('No password is set.')).toBeVisible()
    // Why: the tab triggers fade their colours; the picture is taken once they settle.
    await orcaPage.waitForTimeout(400)
    await shot('stand-users')
    await orcaPage
      .getByRole('row', { name: /admin@box\.test/ })
      .getByRole('button', { name: 'Log in' })
      .click()
    await expect
      .poll(async () =>
        (await getBrowserTabs(orcaPage, worktreeId)).some((t) => t.url?.startsWith(mock.baseUrl))
      )
      .toBe(true)
    await expect
      .poll(() => mock.logins, { timeout: 30_000 })
      .toEqual([{ username: 'admin@box.test', password: mock.password }])
    expect(await orcaPage.evaluate(() => document.body.innerText)).not.toContain(mock.password)
  } finally {
    await stopCapture()
  }
})
