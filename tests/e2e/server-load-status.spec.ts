/**
 * A paired `orca serve` host answers `diagnostics.host` with its own CPU and memory, and the
 * desktop paired to it shows that server's load in the status bar, bullet first.
 */

import path from 'node:path'
import { expect, test } from './helpers/orca-app'
import { launchHeadlessPairedRuntimeHost } from './helpers/headless-paired-runtime-host'
import { launchPairedElectronClient } from './helpers/paired-electron-client'
import { startHiddenRendererFrameCapture } from './helpers/hidden-renderer-frame-capture'

test('status bar: a paired server shows its CPU and memory', async ({ testRepoPath }, testInfo) => {
  test.setTimeout(180_000)
  const host = await launchHeadlessPairedRuntimeHost()
  try {
    const answer = await host.client.call<{
      cpuPercent: number | null
      memoryUsagePercent: number
      totalMemory: number
      cpuCoreCount: number
    }>('diagnostics.host')
    expect(answer.result.totalMemory).toBeGreaterThan(0)
    expect(answer.result.cpuCoreCount).toBeGreaterThan(0)
    expect(answer.result.memoryUsagePercent).toBeGreaterThanOrEqual(0)
    expect(answer.result.cpuPercent).not.toBeNull()

    await host.client.call('repo.add', { path: testRepoPath, kind: 'git' })
    const client = await launchPairedElectronClient(host.offer, testInfo, 'server load')
    try {
      const stopCapture = await startHiddenRendererFrameCapture(client.page)
      try {
        const chip = client.page.getByLabel(/: CPU \d+%, memory \d+%$/)
        await expect(chip).toBeVisible({ timeout: 60_000 })
        await testInfo.attach('server-load-status', {
          body: await client.page.screenshot({
            path: path.join(testInfo.outputDir, 'server-load-status.png')
          }),
          contentType: 'image/png'
        })
      } finally {
        await stopCapture()
      }
    } finally {
      await client.dispose()
    }
  } finally {
    await host.dispose()
  }
})
