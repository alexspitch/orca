import type { BrowserWindow } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadUpdaterModule, warmUpdaterModule } from './updater-test-module-loader'

function windowSending(send: ReturnType<typeof vi.fn>): BrowserWindow {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the updater only reaches the window through webContents.send.
  return { webContents: { send } } as unknown as BrowserWindow
}

const {
  autoUpdaterMock,
  fetchChangelogMock,
  fetchNudgeMock,
  fetchNewerReleaseTagsMock,
  moduleFactories,
  resetUpdaterMocks
} = await vi.hoisted(async () => (await import('./updater-test-harness')).createUpdaterMocks())

const CUSTOM_FEED = {
  url: 'https://build-web.example/orca-updates',
  releaseNotesUrl: 'https://build-web.example/orca'
}
const { getCustomUpdateFeedMock } = vi.hoisted(() => ({
  getCustomUpdateFeedMock: vi.fn<() => typeof CUSTOM_FEED | null>()
}))

vi.mock('electron', () => moduleFactories.electron())
vi.mock('electron-updater', () => moduleFactories.electronUpdater())
vi.mock('./electron-updater-loader', () => moduleFactories.electronUpdaterLoader())
vi.mock('@electron-toolkit/utils', () => moduleFactories.electronToolkitUtils())
vi.mock('./ipc/pty/kill-all', () => moduleFactories.ptyKillAll())
vi.mock('./linux-update-package-type', () => moduleFactories.linuxUpdatePackageType())
vi.mock('./updater-lifecycle-diagnostics', () => moduleFactories.updaterLifecycleDiagnostics())
vi.mock('./updater-changelog', () => moduleFactories.updaterChangelog())
vi.mock('./updater-nudge', () => moduleFactories.updaterNudge())
vi.mock('./update-install-exit-watchdog', () => moduleFactories.updateInstallExitWatchdog())
vi.mock('./updater-prerelease-feed', () => moduleFactories.updaterPrereleaseFeed())
vi.mock('./local-builds/local-build-switch', () => moduleFactories.localBuildSwitch())
vi.mock('./local-builds/local-build-feed-server', () => moduleFactories.localBuildFeedServer())
vi.mock('./updater/custom-update-feed', () => ({ getCustomUpdateFeed: getCustomUpdateFeedMock }))

warmUpdaterModule()

describe('updater with a custom update feed', () => {
  beforeEach(() => {
    resetUpdaterMocks()
    getCustomUpdateFeedMock.mockReset().mockReturnValue(CUSTOM_FEED)
  })

  it('checks only the packaged feed, never the GitHub releases or onorca.dev campaigns', async () => {
    autoUpdaterMock.checkForUpdates.mockResolvedValue(undefined)
    const { setupAutoUpdater, checkForUpdatesFromMenu } = await loadUpdaterModule()
    setupAutoUpdater(windowSending(vi.fn()), {
      getLastUpdateCheckAt: () => Date.now()
    })
    expect(autoUpdaterMock.setFeedURL).toHaveBeenLastCalledWith({
      provider: 'generic',
      url: CUSTOM_FEED.url
    })

    checkForUpdatesFromMenu()

    await vi.waitFor(() => {
      expect(autoUpdaterMock.checkForUpdates).toHaveBeenCalledTimes(1)
    })
    expect(autoUpdaterMock.setFeedURL).toHaveBeenLastCalledWith({
      provider: 'generic',
      url: CUSTOM_FEED.url
    })
    expect(fetchNewerReleaseTagsMock).not.toHaveBeenCalled()
    expect(fetchNudgeMock).not.toHaveBeenCalled()
  })

  it('offers a custom build with its release page instead of the upstream changelog', async () => {
    autoUpdaterMock.checkForUpdates.mockImplementation(() => {
      autoUpdaterMock.emit('checking-for-update')
      autoUpdaterMock.emit('update-available', { version: '2.0.0-custom.1.abc' })
      return Promise.resolve(undefined)
    })
    const send = vi.fn()
    const { setupAutoUpdater, checkForUpdatesFromMenu } = await loadUpdaterModule()
    setupAutoUpdater(windowSending(send), { getLastUpdateCheckAt: () => Date.now() })

    checkForUpdatesFromMenu()

    await vi.waitFor(() => {
      expect(send).toHaveBeenCalledWith('updater:status', {
        state: 'available',
        version: '2.0.0-custom.1.abc',
        changelog: null,
        releaseUrl: CUSTOM_FEED.releaseNotesUrl
      })
    })
    expect(fetchChangelogMock).not.toHaveBeenCalled()
  })

  it('keeps the GitHub release feed for an upstream build', async () => {
    getCustomUpdateFeedMock.mockReturnValue(null)
    const { setupAutoUpdater } = await loadUpdaterModule()
    setupAutoUpdater(windowSending(vi.fn()), {
      getLastUpdateCheckAt: () => Date.now()
    })
    expect(autoUpdaterMock.setFeedURL).toHaveBeenLastCalledWith({
      provider: 'generic',
      url: 'https://github.com/stablyai/orca/releases/latest/download'
    })
  })
})
