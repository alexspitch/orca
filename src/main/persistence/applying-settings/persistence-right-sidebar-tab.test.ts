import { describe, expect, it, vi } from 'vitest'

// Stub Electron at import time without loading the full Store fixture.
vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/orca-persistence-right-sidebar-tab-test'
  },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (plaintext: string) => Buffer.from(plaintext, 'utf-8'),
    decryptString: (ciphertext: Buffer) => ciphertext.toString('utf-8')
  }
}))

import { normalizeRightSidebarTab } from './ui-selection-normalization'
import { STATIC_RIGHT_SIDEBAR_TABS } from '../../../shared/rpc-contract/client-ui-params'

describe('normalizeRightSidebarTab', () => {
  it.each(['explorer', 'search', 'vault', 'workspaces', 'source-control', 'checks', 'ports'])(
    'preserves the built-in %s tab',
    (tab) => {
      expect(normalizeRightSidebarTab(tab)).toBe(tab)
    }
  )

  it('preserves the folder-only pr-checks tab', () => {
    expect(normalizeRightSidebarTab('pr-checks')).toBe('pr-checks')
  })

  // Regression: services was missing too, so any UI-state save (resizing the panel) left its tab.
  it.each([...STATIC_RIGHT_SIDEBAR_TABS])('preserves every static tab: %s', (tab) => {
    expect(normalizeRightSidebarTab(tab)).toBe(tab)
  })

  it('preserves well-formed plugin panel tabs', () => {
    expect(normalizeRightSidebarTab('plugin:orca-samples.my-plugin/dashboard')).toBe(
      'plugin:orca-samples.my-plugin/dashboard'
    )
  })

  it('normalizes malformed plugin tabs to the default tab', () => {
    expect(normalizeRightSidebarTab('plugin:orca-samples.my-plugin')).toBe('explorer')
    expect(normalizeRightSidebarTab('plugin:orca-samples.my-plugin/panel/extra')).toBe('explorer')
    expect(normalizeRightSidebarTab('plugin:My_Plugin/Panel!')).toBe('explorer')
  })

  it('normalizes unknown values to the default tab', () => {
    expect(normalizeRightSidebarTab('bogus')).toBe('explorer')
    expect(normalizeRightSidebarTab(undefined)).toBe('explorer')
    expect(normalizeRightSidebarTab(42)).toBe('explorer')
  })
})
