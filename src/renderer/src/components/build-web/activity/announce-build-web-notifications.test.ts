import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BuildWebNotification } from '../../../../../shared/build-web-activity-types'
import { getDefaultNotificationSettings } from '../../../../../shared/notification-settings-defaults'

// New bell rows: a desktop banner while Orca is in the background, a toast while it is in front.

const mocks = vi.hoisted(() => ({ toast: vi.fn(), dispatch: vi.fn() }))
vi.mock('sonner', () => ({ toast: mocks.toast }))

const { announceBuildWebNotifications } = await import('./announce-build-web-notifications')

const note = (id: string): BuildWebNotification => ({
  id,
  kind: 'build',
  severity: 'error',
  title: `Image build failed ${id}`,
  body: 'dc/app — FAILURE #12\nhttps://jenkins.test/job/dc/12/',
  issue_id: 'i1',
  issue_key: 'IS-10',
  run_id: 'r1',
  count: 1,
  last_at: '2026-10-21T09:00:00Z',
  unread: true
})

let focused = false

beforeEach(() => {
  mocks.toast.mockReset()
  mocks.dispatch.mockReset().mockResolvedValue({ delivered: true })
  vi.stubGlobal('window', { api: { notifications: { dispatch: mocks.dispatch } } })
  vi.stubGlobal('document', { hasFocus: () => focused })
})
afterEach(() => vi.unstubAllGlobals())

describe('announcing new build-web notifications', () => {
  it('raises a banner per row while Orca is in the background', () => {
    focused = false
    announceBuildWebNotifications([note('n1')], getDefaultNotificationSettings(), vi.fn())
    expect(mocks.dispatch).toHaveBeenCalledWith({
      source: 'build-web',
      notificationId: 'build-web:n1',
      attentionKey: 'build-web:n1',
      buildWeb: {
        title: 'Image build failed n1',
        body: 'IS-10 · dc/app — FAILURE #12',
        target: {
          kind: 'build',
          issue_id: 'i1',
          run_id: 'r1',
          title: 'Image build failed n1',
          last_at: '2026-10-21T09:00:00Z'
        }
      }
    })
    expect(mocks.toast).not.toHaveBeenCalled()
  })

  it('shows a toast that opens the row while Orca is in front, unless that is off', () => {
    focused = true
    const open = vi.fn()
    announceBuildWebNotifications([note('n1')], getDefaultNotificationSettings(), open)
    expect(mocks.dispatch).not.toHaveBeenCalled()
    const [title, options] = mocks.toast.mock.calls[0]
    expect(title).toBe('Image build failed n1')
    options.action.onClick()
    expect(open).toHaveBeenCalledWith({
      kind: 'build',
      issue_id: 'i1',
      run_id: 'r1',
      title: 'Image build failed n1',
      last_at: '2026-10-21T09:00:00Z'
    })

    mocks.toast.mockReset()
    announceBuildWebNotifications(
      [note('n2')],
      { ...getDefaultNotificationSettings(), buildWebToastWhenFocused: false },
      open
    )
    expect(mocks.toast).not.toHaveBeenCalled()
  })

  it('folds a burst into one line, and says nothing when switched off', () => {
    focused = false
    const burst = ['a', 'b', 'c', 'd'].map(note)
    announceBuildWebNotifications(burst, getDefaultNotificationSettings(), vi.fn())
    expect(mocks.dispatch).toHaveBeenCalledTimes(1)
    expect(mocks.dispatch.mock.calls[0][0].buildWeb).toMatchObject({
      title: 'build-web: 4 new notifications',
      target: null
    })

    mocks.dispatch.mockReset()
    announceBuildWebNotifications(
      [note('e')],
      { ...getDefaultNotificationSettings(), buildWeb: false },
      vi.fn()
    )
    announceBuildWebNotifications(
      [note('f')],
      { ...getDefaultNotificationSettings(), enabled: false },
      vi.fn()
    )
    expect(mocks.dispatch).not.toHaveBeenCalled()
  })
})
