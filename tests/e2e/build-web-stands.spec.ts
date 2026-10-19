/**
 * The Stands page against a build-web console on loopback: the list of stands, a stand's services
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
  orcaPage,
  electronApp
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

    await orcaPage.getByRole('button', { name: 'Stands', exact: true }).click()
    await expect(orcaPage.getByRole('button', { name: /^sa 2\.16/ })).toBeVisible()
    await expect(orcaPage.getByRole('button', { name: /^storage box/ })).toHaveCount(0)
    await shot('stand-directory')
    await orcaPage.getByRole('button', { name: /^3\.1 box/ }).click()
    await expect(orcaPage.getByRole('heading', { name: '3.1 box' })).toBeVisible()
    await expect(orcaPage.getByText('#11830')).toBeVisible()
    const builtAt = await orcaPage.evaluate(() => new Date('2026-10-18T21:05:11Z').toLocaleString())
    await expect(orcaPage.getByText(builtAt)).toBeVisible()
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
    await orcaPage.getByRole('combobox', { name: 'Application' }).click()
    await orcaPage.getByRole('option', { name: 'AP', exact: true }).click()
    await expect(orcaPage.getByText('ap@box.test')).toBeVisible()
    await expect(orcaPage.getByText('admin@box.test')).toHaveCount(0)
    await orcaPage.getByRole('combobox', { name: 'Application' }).click()
    await orcaPage.getByRole('option', { name: 'All applications' }).click()
    // Why: the tab triggers fade their colours; the picture is taken once they settle.
    await orcaPage.waitForTimeout(400)
    await shot('stand-users')
    await orcaPage
      .getByRole('row', { name: /admin@box\.test/ })
      .getByRole('button', { name: 'Log in' })
      .click()
    await expect
      .poll(async () =>
        (await getBrowserTabs(orcaPage, worktreeId)).some((t) => t.url?.startsWith(mock.uiUrl))
      )
      .toBe(true)
    await expect
      .poll(() => mock.logins, { timeout: 30_000 })
      .toEqual([{ username: 'admin@box.test', password: mock.password }])
    expect(await orcaPage.evaluate(() => document.body.innerText)).not.toContain(mock.password)

    // Log in again: the profile's session is alive, so the app opens with no form — and a logout
    // made in that tab must show the form, not sign the reader straight back in.
    await orcaPage.evaluate(() => window.__store?.getState().openBuildWebStandsPage())
    await orcaPage
      .getByRole('row', { name: /admin@box\.test/ })
      .getByRole('button', { name: 'Log in' })
      .click()
    const home = `${mock.uiUrl}/app/home`
    const guestIds = async () =>
      electronApp.evaluate(
        ({ webContents }, url) =>
          webContents
            .getAllWebContents()
            .filter((w) => w.getType() === 'webview' && w.getURL() === url)
            .map((w) => w.id),
        home
      )
    await expect.poll(async () => (await guestIds()).length, { timeout: 30_000 }).toBe(2)
    const second = Math.max(...(await guestIds()))
    await electronApp.evaluate(
      async ({ webContents }, { id, logout }) => {
        const guest = webContents.fromId(id)
        if (!guest) {
          throw new Error('the second login tab is gone')
        }
        guest.sendInputEvent({ type: 'mouseDown', x: 20, y: 20, button: 'left', clickCount: 1 })
        guest.sendInputEvent({ type: 'mouseUp', x: 20, y: 20, button: 'left', clickCount: 1 })
        await guest.loadURL(logout)
      },
      { id: second, logout: `${mock.uiUrl}/logout` }
    )
    await expect
      .poll(
        () =>
          electronApp.evaluate(
            ({ webContents }, id) => webContents.fromId(id)?.getURL() ?? '',
            second
          ),
        { timeout: 15_000 }
      )
      .toContain('/login')
    await orcaPage.waitForTimeout(2000)
    expect(mock.logins).toHaveLength(1)
  } finally {
    await stopCapture()
  }
})
