import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import type * as Os from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Connecting to build-web: what is verified before saving, what a status read may
// not do (decrypt), and that the token goes to exactly the origin it was issued for.

const decryptSpy = vi.fn((value: Buffer) => value.toString('utf-8'))
let tempHome = ''
const fetchSpy = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>()

async function loadModules() {
  vi.resetModules()
  const { setSecretStore } = await import('../../shared/secret-store')
  setSecretStore({
    isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(value),
    decryptString: decryptSpy,
    describeProtectionGap: () => null
  })
  vi.doMock('node:os', async () => {
    const actual = await vi.importActual<typeof Os>('node:os')
    return { ...actual, homedir: () => tempHome }
  })
  const { setMainHttpClient } = await import('../network/http-client')
  setMainHttpClient({ fetch: fetchSpy, proxySession: () => null })
  return {
    connection: await import('./build-web-connection'),
    store: await import('./credential-store'),
    request: await import('./build-web-request')
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'orca-build-web-'))
  decryptSpy.mockClear()
  fetchSpy.mockReset()
})

afterEach(() => {
  vi.doUnmock('node:os')
})

describe('build-web base URL', () => {
  it('keeps only the origin of an https address', async () => {
    const { request } = await loadModules()
    expect(
      request.normalizeBuildWebBaseUrl(' https://tw.spitch-dev.ai:8585/tms/issues?x=1#y ')
    ).toBe('https://tw.spitch-dev.ai:8585')
  })

  it('refuses plain http off loopback, credentials in the URL, and garbage', async () => {
    const { request } = await loadModules()
    expect(request.normalizeBuildWebBaseUrl('http://tw.spitch-dev.ai:8585')).toBeNull()
    expect(request.normalizeBuildWebBaseUrl('https://user:pass@tw.spitch-dev.ai')).toBeNull()
    expect(request.normalizeBuildWebBaseUrl('javascript:alert(1)')).toBeNull()
    expect(request.normalizeBuildWebBaseUrl('not a url')).toBeNull()
    expect(request.normalizeBuildWebBaseUrl('http://127.0.0.1:8787')).toBe('http://127.0.0.1:8787')
  })
})

describe('connecting', () => {
  it('verifies the token with /api/me, then stores the account and sections', async () => {
    const { connection } = await loadModules()
    fetchSpy.mockResolvedValue(
      json({ authed: true, user: 'alex@spitch.ch', perms: ['issues', 'build'] })
    )
    const result = await connection.connectBuildWeb({
      baseUrl: 'https://bw.test:8585/',
      token: ' bwt_abc '
    })
    expect(result).toMatchObject({ ok: true, status: { connected: true, login: 'alex@spitch.ch' } })
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://bw.test:8585/api/me')
    expect(init?.redirect).toBe('error')
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer bwt_abc')
    const metadata = readFileSync(join(tempHome, '.orca', 'build-web-credential.json'), 'utf-8')
    expect(metadata).not.toContain('bwt_abc')
  })

  it('refuses a token /api/me does not take, and saves nothing', async () => {
    const { connection } = await loadModules()
    fetchSpy.mockResolvedValue(json({ authed: false }))
    const result = await connection.connectBuildWeb({
      baseUrl: 'https://bw.test',
      token: 'bwt_dead'
    })
    expect(result.ok).toBe(false)
    expect(connection.getBuildWebStatus().connected).toBe(false)
  })

  it('says the console is unreachable without echoing the token', async () => {
    const { connection } = await loadModules()
    fetchSpy.mockRejectedValue(new Error('connect ECONNREFUSED'))
    const result = await connection.connectBuildWeb({
      baseUrl: 'https://bw.test',
      token: 'bwt_secret'
    })
    expect(result.ok).toBe(false)
    expect(result.ok ? '' : result.error).toMatch(/unreachable: connect ECONNREFUSED/)
    expect(result.ok ? '' : result.error).not.toContain('bwt_secret')
  })

  it('reads status from metadata only — no decryption on a cold session', async () => {
    const first = await loadModules()
    fetchSpy.mockResolvedValue(json({ authed: true, user: 'alex@spitch.ch', perms: [] }))
    await first.connection.connectBuildWeb({ baseUrl: 'https://bw.test', token: 'bwt_abc' })
    const cold = await loadModules()
    decryptSpy.mockClear()
    expect(cold.connection.getBuildWebStatus()).toMatchObject({
      connected: true,
      baseUrl: 'https://bw.test'
    })
    expect(decryptSpy).not.toHaveBeenCalled()
  })

  it('never hands the token to a different origin', async () => {
    const { store } = await loadModules()
    store.saveBuildWebCredential({
      baseUrl: 'https://bw.test',
      token: 'bwt_abc',
      login: 'a',
      perms: []
    })
    expect(store.loadBuildWebToken('https://bw.test')).toBe('bwt_abc')
    expect(store.loadBuildWebToken('https://evil.test')).toBeNull()
  })

  it('forgets everything on disconnect', async () => {
    const { connection, store } = await loadModules()
    store.saveBuildWebCredential({
      baseUrl: 'https://bw.test',
      token: 'bwt_abc',
      login: 'a',
      perms: []
    })
    expect(connection.disconnectBuildWeb().connected).toBe(false)
    expect(() => connection.requireBuildWebCredential()).toThrow(/not connected/)
  })
})

describe('request errors', () => {
  it('turns 401 and 403 into words that say what to do', async () => {
    const { request } = await loadModules()
    expect(request.describeBuildWebError(new request.BuildWebApiError('bad', 401))).toMatch(
      /new one/
    )
    expect(
      request.describeBuildWebError(
        new request.BuildWebApiError('forbidden', 403, ['build', 'history'])
      )
    ).toBe('forbidden. Needs section: build or history.')
  })

  it('throws the console’s own refusal with its status', async () => {
    const { request } = await loadModules()
    fetchSpy.mockResolvedValue(json({ error: 'сначала закройте подзадачи' }, 409))
    await expect(
      request.buildWebRequest({ baseUrl: 'https://bw.test', token: 't', path: '/api/x' })
    ).rejects.toMatchObject({ status: 409, message: 'сначала закройте подзадачи' })
  })
})
