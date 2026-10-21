/**
 * The new-tab menu offers Claude under each other account of the workspace's host, beside plain
 * Claude. Not launched here: setting up an account folder links history into the real ~/.claude.
 */

import path from 'node:path'
import { expect, test } from './helpers/orca-app'
import { configureGoldenStubAgent, getGoldenStubAgentLaunchEnv } from './helpers/golden-stub-agent'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'

test.use({ launchEnv: getGoldenStubAgentLaunchEnv() })

test('new-tab menu: Claude under another account of this host', async ({ orcaPage }, testInfo) => {
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)
  await ensureTerminalVisible(orcaPage)
  await configureGoldenStubAgent(orcaPage, { agent: 'claude' })
  await orcaPage.evaluate(async () => {
    const account = (id: string, label: string) => ({
      id,
      email: `${id}@box.test`,
      label,
      authMethod: 'subscription-oauth' as const,
      managedAuthPath: '',
      createdAt: 0,
      updatedAt: 0,
      lastAuthenticatedAt: 0
    })
    await window.__store?.getState().updateSettings({
      claudeManagedAccounts: [account('acc-work', 'Work'), account('acc-team', 'Team')]
    })
  })

  await orcaPage.getByRole('button', { name: 'New tab' }).click({ force: true })
  const menu = orcaPage.getByRole('menu')
  await expect(menu.getByRole('menuitem', { name: 'Claude — Work' })).toBeVisible({
    timeout: 15_000
  })
  await expect(menu.getByRole('menuitem', { name: 'Claude — Team' })).toBeVisible()
  await testInfo.attach('new-tab-menu', {
    body: await orcaPage.screenshot({ path: path.join(testInfo.outputDir, 'new-tab-menu.png') }),
    contentType: 'image/png'
  })
})
