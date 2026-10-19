import type { InputEvent, WebContents } from 'electron'
import { browserManager } from './browser-manager'

// Sign a freshly opened browser page in: armed for one page id before its tab exists, it fills the
// login form once when that page lands on it by itself. The credentials never reach the renderer.

export type LoginAutofillCredentials = {
  username: string
  password: string
  /** The UI being signed in to; only its own login page, or its auth portal's, gets them. */
  uiUrl: string
}

type Armed = LoginAutofillCredentials & {
  timer: ReturnType<typeof setTimeout>
  /** Detaches the guest listeners once the page is known. */
  unwatch?: () => void
}

const ARMED_MS = 3 * 60_000
// Why: a login page reached after the reader acted in the tab (a logout) is theirs, not the tab's
// opening sign-in — filling it would put them straight back into the app they just left.
const READER_ACTIONS: ReadonlySet<InputEvent['type']> = new Set([
  'mouseDown',
  'rawKeyDown',
  'keyDown',
  'touchStart',
  'pointerDown',
  'gestureTap'
])
const armed = new Map<string, Armed>()
let subscribed = false

function originOf(url: string | null): string | null {
  try {
    return url ? new URL(url).origin : null
  } catch {
    return null
  }
}

/**
 * The login page of this UI, not one that came back with a refusal: on the UI's own host (any
 * port), or an auth portal elsewhere whose OAuth `redirect_uri` leads back to the UI.
 */
export function isLoginPage(url: string, uiUrl: string): boolean {
  let parsed: URL
  let ui: URL
  try {
    parsed = new URL(url)
    ui = new URL(uiUrl)
  } catch {
    return false
  }
  const forThisUi =
    parsed.hostname === ui.hostname ||
    originOf(parsed.searchParams.get('redirect_uri')) === ui.origin
  return (
    (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
    forThisUi &&
    /\/login(\/|$)/.test(parsed.pathname) &&
    !parsed.searchParams.has('error_message')
  )
}

// Why: U+2028/U+2029 end a line in older script parsers; escaped, the literal stays one line.
const LINE_SEPARATORS = new RegExp(`[${String.fromCharCode(0x2028, 0x2029)}]`, 'g')

function jsString(value: string): string {
  return JSON.stringify(value).replace(LINE_SEPARATORS, (c) => `\\u${c.charCodeAt(0).toString(16)}`)
}

/** Fill the portal's form the way typing would, so a framework-controlled input keeps the value. */
export function loginFillScript(username: string, password: string): string {
  return `(async (u, p) => {
  const pick = () => [
    document.querySelector('input[name="username"]'),
    document.querySelector('input[name="password"]'),
    document.querySelector('#submit')
  ]
  const deadline = Date.now() + 10000
  let [user, pass, submit] = pick()
  while (!(user && pass && submit) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 200))
    ;[user, pass, submit] = pick()
  }
  if (!(user && pass && submit)) return false
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  for (const [input, value] of [[user, u], [pass, p]]) {
    setValue.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }
  submit.click()
  return true
})(${jsString(username)}, ${jsString(password)})`
}

function disarm(browserPageId: string): void {
  const entry = armed.get(browserPageId)
  if (entry) {
    clearTimeout(entry.timer)
    entry.unwatch?.()
    armed.delete(browserPageId)
  }
}

function watchGuest(browserPageId: string, guest: WebContents): void {
  const entry = armed.get(browserPageId)
  if (!entry) {
    return
  }
  const tryFill = (): void => {
    if (guest.isDestroyed() || !isLoginPage(guest.getURL(), entry.uiUrl)) {
      return
    }
    disarm(browserPageId)
    void guest
      .executeJavaScript(loginFillScript(entry.username, entry.password), true)
      .catch(() => {})
  }
  const onDestroyed = (): void => disarm(browserPageId)
  const onInput = (_event: unknown, input: InputEvent): void => {
    if (READER_ACTIONS.has(input.type)) {
      disarm(browserPageId)
    }
  }
  entry.unwatch?.()
  entry.unwatch = () => {
    guest.off('did-finish-load', tryFill)
    guest.off('did-navigate-in-page', tryFill)
    guest.off('input-event', onInput)
    guest.off('destroyed', onDestroyed)
  }
  guest.on('did-finish-load', tryFill)
  // Why: a single-page app moves to its login route without a load.
  guest.on('did-navigate-in-page', tryFill)
  guest.on('input-event', onInput)
  guest.once('destroyed', onDestroyed)
  if (!guest.isLoading()) {
    tryFill()
  }
}

/** Arm the fill for the page that is about to open; it expires unused if no login page shows. */
export function armLoginAutofill(
  browserPageId: string,
  credentials: LoginAutofillCredentials
): void {
  if (!subscribed) {
    subscribed = true
    browserManager.onGuestRegistered(watchGuest)
  }
  disarm(browserPageId)
  const timer = setTimeout(() => disarm(browserPageId), ARMED_MS)
  timer.unref?.()
  armed.set(browserPageId, { ...credentials, timer })
}
