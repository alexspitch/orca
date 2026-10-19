import { describe, expect, it, vi } from 'vitest'

vi.mock('@/store', () => ({ useAppStore: Object.assign(() => null, { getState: () => ({}) }) }))
vi.mock('../build-web-client', () => ({ callBuildWeb: vi.fn() }))

import type {
  BuildWebStandAccount,
  BuildWebStandCard
} from '../../../../../shared/build-web-stand-types'
import { accountLoginBlockedBy, standLoginBlockedBy } from './stand-login'

const context = {
  pairedWeb: false,
  targetKind: 'local' as const,
  worktreeId: 'wt-1',
  browser: 'local-client' as const
}
const account = (over: Partial<BuildWebStandAccount> = {}): BuildWebStandAccount => ({
  id: 'a1',
  description: 'admin',
  email: 'admin@x.ch',
  standId: 'c1',
  role: 'admin',
  projectName: '',
  password: 'set',
  ...over
})
const card = (over: Partial<BuildWebStandCard> = {}): BuildWebStandCard => ({
  id: 'c1',
  name: 'dc 3.1',
  sshHost: 'h',
  dir: '/opt/dc/3.1',
  branch: null,
  product: 'dc',
  products: ['dc'],
  uiUrl: 'https://dc.invalid',
  enabled: true,
  lock: null,
  ...over
})

describe('logging in to a stand', () => {
  it('opens a tab only in the desktop app, holding the token, in a local workspace', () => {
    expect(standLoginBlockedBy(context)).toBeNull()
    expect(standLoginBlockedBy({ ...context, pairedWeb: true })).not.toBeNull()
    expect(standLoginBlockedBy({ ...context, targetKind: 'environment' })).not.toBeNull()
    expect(standLoginBlockedBy({ ...context, worktreeId: null })).not.toBeNull()
    expect(standLoginBlockedBy({ ...context, browser: 'paired-runtime' })).not.toBeNull()
  })

  it('needs a password that works and a UI to sign in to', () => {
    expect(accountLoginBlockedBy(account(), card())).toBeNull()
    expect(accountLoginBlockedBy(account({ password: 'missing' }), card())).not.toBeNull()
    expect(accountLoginBlockedBy(account({ password: 'broken' }), card())).not.toBeNull()
    expect(accountLoginBlockedBy(account(), card({ uiUrl: null }))).not.toBeNull()
    expect(accountLoginBlockedBy(account(), undefined)).not.toBeNull()
  })
})
