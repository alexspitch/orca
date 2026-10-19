import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'

type GuestListener = (pageId: string, guest: unknown) => void

const mocks = vi.hoisted(() => {
  const state: { listener: GuestListener | null } = { listener: null }
  return state
})

vi.mock('./browser-manager', () => ({
  browserManager: {
    onGuestRegistered: (listener: (pageId: string, guest: unknown) => void) => {
      mocks.listener = listener
      return () => {}
    }
  }
}))

const { armLoginAutofill, isLoginPage, loginFillScript } = await import('./browser-login-autofill')

class FakeGuest extends EventEmitter {
  url = 'about:blank'
  loading = true
  scripts: string[] = []
  getURL(): string {
    return this.url
  }
  isLoading(): boolean {
    return this.loading
  }
  isDestroyed(): boolean {
    return false
  }
  executeJavaScript(code: string): Promise<unknown> {
    this.scripts.push(code)
    return Promise.resolve(true)
  }
  land(url: string): void {
    this.url = url
    this.loading = false
    this.emit('did-finish-load')
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('the portal’s login page', () => {
  const ui = 'https://dc31.test:23101'

  it('is the login path on the stand’s host, any port, not a refusal', () => {
    expect(isLoginPage('https://dc31.test:8443/login?x=1', ui)).toBe(true)
    expect(isLoginPage('https://dc31.test/auth/login', ui)).toBe(true)
    expect(isLoginPage('https://dc31.test/login?error_message=login.errors.x', ui)).toBe(false)
    expect(isLoginPage('https://evil.test/login', ui)).toBe(false)
    expect(isLoginPage('https://dc31.test/loginhelp', ui)).toBe(false)
    expect(isLoginPage('file:///login', ui)).toBe(false)
  })

  it('is an auth portal on another host whose OAuth redirect leads back to this UI', () => {
    const portal = 'https://dc30.test:23102/login?response_type=code&client_id=dc&redirect_uri='
    expect(isLoginPage(`${portal}${encodeURIComponent(`${ui}/dc_callback`)}`, ui)).toBe(true)
    expect(isLoginPage(`${portal}https://dc31.test:23101/dc_callback`, ui)).toBe(true)
    expect(isLoginPage(`${portal}https://other.test:23101/cb`, ui)).toBe(false)
    expect(isLoginPage(`${portal}https://dc31.test:9999/cb`, ui)).toBe(false)
    expect(isLoginPage('https://dc30.test:23102/login', ui)).toBe(false)
  })

  it('carries the values as string literals the page cannot break out of', () => {
    const script = loginFillScript(`a'");alert(1)//`, `p${String.fromCharCode(0x2028)}w`)
    expect(script).toContain(JSON.stringify(`a'");alert(1)//`))
    expect(script).not.toContain(String.fromCharCode(0x2028))
    expect(script).toContain('\\u2028')
  })
})

describe('filling the form of an armed page', () => {
  it('fills once, on the login page, and never on another page', async () => {
    armLoginAutofill('page-1', { username: 'u@x', password: 'secret', uiUrl: 'https://dc.test' })
    const guest = new FakeGuest()
    mocks.listener?.('page-1', guest)
    guest.land('https://dc.test:23101/app')
    expect(guest.scripts).toHaveLength(0)
    guest.land('https://dc.test:8443/login')
    expect(guest.scripts).toHaveLength(1)
    expect(guest.scripts[0]).toContain('"secret"')
    guest.land('https://dc.test:8443/login')
    expect(guest.scripts).toHaveLength(1)
  })

  it('leaves a login page alone that the reader reached by acting in the tab, as a logout', () => {
    armLoginAutofill('page-4', { username: 'u', password: 'p', uiUrl: 'https://dc.test' })
    const guest = new FakeGuest()
    mocks.listener?.('page-4', guest)
    // Signed in already: the app opens, no form to fill.
    guest.land('https://dc.test/app')
    guest.emit('input-event', {}, { type: 'mouseMove' })
    guest.emit('input-event', {}, { type: 'mouseDown' })
    guest.land('https://dc.test/login')
    expect(guest.scripts).toHaveLength(0)
  })

  it('leaves a page alone that was never armed, or armed too long ago', async () => {
    vi.useFakeTimers()
    const other = new FakeGuest()
    mocks.listener?.('page-2', other)
    other.land('https://dc.test/login')
    expect(other.scripts).toHaveLength(0)

    armLoginAutofill('page-3', { username: 'u', password: 'p', uiUrl: 'https://dc.test' })
    vi.advanceTimersByTime(4 * 60_000)
    const late = new FakeGuest()
    mocks.listener?.('page-3', late)
    late.land('https://dc.test/login')
    expect(late.scripts).toHaveLength(0)
  })
})
