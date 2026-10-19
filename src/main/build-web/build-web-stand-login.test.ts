import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as RequestModule from './build-web-request'

type Profile = { id: string; scope: string; label: string; partition: string }

const mocks = vi.hoisted(() => {
  const profiles: Profile[] = []
  return {
    request: vi.fn<(request: { path: string; method?: string }) => Promise<unknown>>(),
    profiles,
    create: vi.fn(),
    arm: vi.fn()
  }
})

vi.mock('./build-web-connection', () => ({
  requireBuildWebCredential: () => ({ baseUrl: 'https://bw.test', token: 't', generation: 1 })
}))
vi.mock('./build-web-request', async (importOriginal) => ({
  ...(await importOriginal<typeof RequestModule>()),
  buildWebRequest: mocks.request
}))
vi.mock('../browser/browser-session-registry', () => ({
  browserSessionRegistry: {
    listProfiles: () => mocks.profiles,
    createProfile: mocks.create
  }
}))
vi.mock('../browser/browser-login-autofill', () => ({ armLoginAutofill: mocks.arm }))

const { BuildWebApiError } = await import('./build-web-request')
const { startBuildWebStandLogin } = await import('./build-web-stand-login')

const CREDENTIALS = {
  email: 'admin@x.ch',
  password: 'pa$$w0rd',
  ui_url: 'https://dc31.test:23101',
  stand_id: 'c1',
  stand_name: 'dc 3.1'
}

beforeEach(() => {
  mocks.request.mockReset()
  mocks.create.mockReset()
  mocks.arm.mockReset()
  mocks.profiles = []
  mocks.create.mockImplementation(async (scope: string, label: string) => {
    const profile = { id: `p${mocks.profiles.length}`, scope, label, partition: 'persist:p' }
    mocks.profiles.push(profile)
    return profile
  })
})

describe('logging in to a stand', () => {
  it('arms the fill with the login and hands back only where to open the tab', async () => {
    mocks.request.mockResolvedValue(CREDENTIALS)
    const result = await startBuildWebStandLogin({ accountId: 'a 1', browserPageId: 'page-1' })
    expect(mocks.request.mock.calls[0][0]).toMatchObject({
      method: 'POST',
      path: '/api/ui-accounts/a%201/credentials'
    })
    expect(mocks.arm).toHaveBeenCalledWith('page-1', {
      username: 'admin@x.ch',
      password: 'pa$$w0rd',
      hostname: 'dc31.test'
    })
    expect(result).toEqual({
      ok: true,
      value: {
        profileId: 'p0',
        partition: 'persist:p',
        url: 'https://dc31.test:23101',
        title: 'dc 3.1 · admin@x.ch'
      }
    })
    expect(JSON.stringify(result)).not.toContain('pa$$w0rd')
  })

  it('keeps one profile per login, even for a double click', async () => {
    mocks.request.mockResolvedValue(CREDENTIALS)
    await Promise.all([
      startBuildWebStandLogin({ accountId: 'a', browserPageId: 'p1' }),
      startBuildWebStandLogin({ accountId: 'a', browserPageId: 'p2' })
    ])
    await startBuildWebStandLogin({ accountId: 'a', browserPageId: 'p3' })
    expect(mocks.create).toHaveBeenCalledTimes(1)
  })

  it('reports build-web’s refusal next to the row and arms nothing', async () => {
    mocks.request.mockRejectedValue(new BuildWebApiError('пароль не задан', 409))
    const result = await startBuildWebStandLogin({ accountId: 'a', browserPageId: 'p' })
    expect(result).toEqual({ ok: false, error: 'пароль не задан', status: 409 })
    expect(mocks.arm).not.toHaveBeenCalled()
  })
})
