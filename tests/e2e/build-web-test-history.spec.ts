/**
 * Testing's «Test history» tab against a build-web console on loopback: the runs revealed as the
 * list scrolls, the nightly/manual filter, a nightly run's changes, its map leading into By test,
 * a test's card, and a job's log.
 */

import path from 'node:path'
import { test, expect } from './helpers/orca-app'
import {
  startBuildWebConsoleMock,
  type BuildWebConsoleMock
} from './helpers/build-web-console-mock'
import { TEST_RUN_COUNT } from './helpers/build-web-test-history-mock'
import { startHiddenRendererFrameCapture } from './helpers/hidden-renderer-frame-capture'
import { waitForSessionReady } from './helpers/store'

let mock: BuildWebConsoleMock

test.beforeEach(async () => {
  mock = await startBuildWebConsoleMock()
})

test.afterEach(async () => {
  await mock.close()
})

test('test history: runs as the list scrolls, a nightly run by change and by test, a log', async ({
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
      await window.__store?.getState().updateSettings({ showBuildWebTestingButton: true })
      window.__store?.getState().openBuildWebTestingPage()
      return result.ok
    }, mock.baseUrl)
    expect(connected).toBe(true)

    // The sidebar item counts the failed tests of the last finished nightly run.
    await expect(orcaPage.getByRole('button', { name: 'Testing, 2 failed' })).toBeVisible()
    await shot('testing-badge')

    await orcaPage.getByRole('tab', { name: 'Test history' }).click()
    const manual = orcaPage.getByRole('button', { name: /case-\d+\.test\.ts/ })
    await expect(orcaPage.getByRole('heading', { name: 'Nightly run of master' })).toBeVisible()
    await expect(manual).toHaveCount(18)
    await expect(orcaPage.getByText(`${TEST_RUN_COUNT} run(s)`)).toBeVisible()

    // Rows arrive as the list scrolls: 20, then 40, then all of them and the note at the end.
    await manual.last().scrollIntoViewIfNeeded()
    await expect(manual).toHaveCount(38)
    await manual.last().scrollIntoViewIfNeeded()
    await expect(manual).toHaveCount(TEST_RUN_COUNT - 2)
    await expect(
      orcaPage.getByText(`End of the list: build-web sends its newest ${TEST_RUN_COUNT} runs.`)
    ).toBeVisible()
    await shot('test-history-list')

    await orcaPage.getByRole('radio', { name: 'Nightly' }).click()
    await expect(manual).toHaveCount(0)
    await expect(orcaPage.getByRole('button', { name: /Recheck of the red/ })).toBeVisible()
    // A new filter starts again from the first portion: 20 manual runs.
    await orcaPage.getByRole('radio', { name: 'Manual' }).click()
    await expect(manual).toHaveCount(20)
    await orcaPage.getByRole('radio', { name: 'All' }).click()

    // The newest run is open: its changes, broken first, the flaky one marked, unchanged counted.
    await expect(orcaPage.getByRole('tab', { name: 'Changes · 5' })).toBeVisible()
    await expect(orcaPage.getByRole('button', { name: /splits a stream/ })).toBeVisible()
    await expect(orcaPage.getByText(/2 retry\(ies\) inside the run/)).toBeVisible()
    await expect(orcaPage.getByText('1 unchanged test(s) are under By test.')).toBeVisible()
    await shot('test-history-changes')

    // A square of the map opens its workspace in By test, red file open with its failure.
    await orcaPage.getByRole('button', { name: 'model-adapters', exact: true }).click()
    await expect(orcaPage.getByRole('tab', { name: 'By test' })).toHaveAttribute(
      'data-state',
      'active'
    )
    await expect(orcaPage.getByText('AssertionError: expected 2 to equal 3')).toBeVisible()
    await shot('test-history-by-test')

    await orcaPage.getByRole('button', { name: /stream › splits a stream/ }).click()
    await expect(orcaPage.getByText(/14 run\(s\) in the history/)).toBeVisible()
    await shot('test-history-case')

    await orcaPage.getByRole('button', { name: 'Log', exact: true }).first().click()
    const dialog = orcaPage.getByRole('dialog')
    await expect(dialog.getByText('Test log')).toBeVisible()
    await expect(dialog.getByText('2 failing')).toBeVisible()
    await expect(dialog.getByText('The log is complete.')).toBeVisible()
    await shot('test-history-log')
  } finally {
    await stopCapture()
  }
})
