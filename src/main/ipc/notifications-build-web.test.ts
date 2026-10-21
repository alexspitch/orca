import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getDispatchHandler,
  getNotificationEventHandler,
  getTrustedUIRendererWindowMock,
  notificationCtorMock,
  resetNotificationDispatchMocks
} from './notifications-test-harness'

vi.mock('electron', async () =>
  (await import('./notifications-test-harness')).createElectronModuleMock()
)

vi.mock('./notification-authorization-status', async () =>
  (await import('./notifications-test-harness')).createNotificationAuthorizationModuleMock()
)

vi.mock('./ui', async () =>
  (await import('./notifications-test-harness')).createTrustedUIRendererModuleMock()
)

vi.mock('../tray/system-tray', async () =>
  (await import('./notifications-test-harness')).createSystemTrayModuleMock()
)

import { registerNotificationHandlers } from './notifications'

// A new row under build-web's bell, as a desktop banner: its words, and a click handed to the
// renderer, which knows the host holding the build-web token.

beforeEach(() => {
  vi.useFakeTimers()
  resetNotificationDispatchMocks()
  vi.stubEnv('ORCA_BACKGROUND_LAUNCH', undefined)
  vi.stubEnv('ORCA_E2E_HEADLESS', undefined)
  vi.stubEnv('ORCA_E2E_HEADFUL', undefined)
})
afterEach(() => vi.unstubAllEnvs())

function registerWithMainWindow(buildWeb: boolean): ReturnType<typeof vi.fn> {
  const webContentsSend = vi.fn()
  getTrustedUIRendererWindowMock.mockReturnValue({
    isDestroyed: () => false,
    isFocused: () => false,
    isMinimized: () => false,
    restore: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
    webContents: { send: webContentsSend }
  })
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: registration reads only getSettings().notifications, which this stub provides.
  registerNotificationHandlers({
    getSettings: () => ({
      notifications: {
        enabled: true,
        agentTaskComplete: true,
        terminalBell: true,
        suppressWhenFocused: true,
        mutedNotificationSourceIds: [],
        buildWeb
      }
    })
  } as never)
  return webContentsSend
}

const target = { kind: 'build', issue_id: 'i1', run_id: 'r1' }

describe('build-web notification banners', () => {
  it('shows the row and hands its click to the renderer', async () => {
    const webContentsSend = registerWithMainWindow(true)

    const result = await getDispatchHandler()(
      {},
      {
        source: 'build-web',
        notificationId: 'build-web:n1',
        attentionKey: 'build-web:n1',
        buildWeb: { title: 'Image build failed: dc/app', body: 'IS-10 · FAILURE #12', target }
      }
    )

    expect(result).toEqual({ delivered: true })
    expect(notificationCtorMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Image build failed: dc/app', body: 'IS-10 · FAILURE #12' })
    )
    getNotificationEventHandler('click')()
    expect(webContentsSend).toHaveBeenCalledWith('notifications:buildWebClick', target)
  })

  it('stays quiet when its switch is off', async () => {
    registerWithMainWindow(false)

    const result = await getDispatchHandler()(
      {},
      { source: 'build-web', buildWeb: { title: 'x', body: '', target: null } }
    )

    expect(result).toEqual({ delivered: false, reason: 'source-disabled' })
    expect(notificationCtorMock).not.toHaveBeenCalled()
  })
})
