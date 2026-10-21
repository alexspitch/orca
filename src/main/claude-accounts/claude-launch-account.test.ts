import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ClaudeManagedAccount } from '../../shared/managed-account-types'
import { applyClaudeLaunchAccount } from './claude-launch-account'
import {
  installClaudeProfileRouter,
  withClaudeProfileTerminalEnv
} from './claude-profile-installed-router'
import { ClaudeProfileRouter, type ClaudeProfileRouterSettings } from './claude-profile-router'

// A pane started for one Claude account runs that account's folder, not the host's selection.

const routed = {
  ORCA_CLAUDE_PROFILE_POINTER: '/data/claude-profiles/selected-host',
  ORCA_CLAUDE_INJECTED_CONFIG_DIR: '/data/claude-profiles/a/home',
  ORCA_CLAUDE_USER_CONFIG_DIR: '/Users/me/.claude-own',
  CLAUDE_CONFIG_DIR: '/data/claude-profiles/a/home',
  ORCA_PANE_KEY: 'tab-1:leaf-1'
}

const savedAccount = (id: string): ClaudeManagedAccount => ({
  id,
  email: `${id}@example.test`,
  authMethod: 'subscription-oauth',
  managedAuthPath: '/unused-legacy',
  createdAt: 0,
  updatedAt: 0,
  lastAuthenticatedAt: 0
})

const settings = () => ({ claudeManagedAccounts: [savedAccount('a'), savedAccount('b')] })

function makeRouter(over: { covered?: boolean; own?: string } = {}) {
  return {
    envReady: Promise.resolve(),
    coveredBySystemDefault: vi.fn(() => over.covered ?? false),
    userConfigDir: vi.fn(() => over.own),
    prepareAccount: vi.fn(async (id: string) => `/data/claude-profiles/${id}/home`)
  }
}

const host = { runtime: 'host' } as const

describe('a pane started for one Claude account', () => {
  it('treats a target without a runtime as this host', async () => {
    const result = await applyClaudeLaunchAccount(
      { ORCA_CLAUDE_LAUNCH_ACCOUNT: 'b' },
      {},
      settings,
      makeRouter()
    )
    expect(result?.env.CLAUDE_CONFIG_DIR).toBe('/data/claude-profiles/b/home')
  })

  it('leaves a pane that names no account to the host routing', async () => {
    const router = makeRouter()
    expect(await applyClaudeLaunchAccount(routed, host, settings, router)).toBeNull()
    expect(router.prepareAccount).not.toHaveBeenCalled()
  })

  it('runs the named account folder, set up first, with the routing gone', async () => {
    const router = makeRouter()
    const result = await applyClaudeLaunchAccount(
      { ...routed, ORCA_CLAUDE_LAUNCH_ACCOUNT: 'b' },
      host,
      settings,
      router
    )
    expect(router.prepareAccount).toHaveBeenCalledWith('b')
    expect(result?.env).toEqual({
      CLAUDE_CONFIG_DIR: '/data/claude-profiles/b/home',
      ORCA_PANE_KEY: 'tab-1:leaf-1'
    })
    expect(result?.envToDelete).toEqual([
      'ORCA_CLAUDE_PROFILE_POINTER',
      'ORCA_CLAUDE_INJECTED_CONFIG_DIR',
      'ORCA_CLAUDE_USER_CONFIG_DIR',
      'ORCA_CLAUDE_LAUNCH_ACCOUNT'
    ])
  })

  it('runs System default when it holds the account, never naming its folder', async () => {
    const plain = await applyClaudeLaunchAccount(
      { ...routed, ORCA_CLAUDE_LAUNCH_ACCOUNT: 'b' },
      host,
      settings,
      makeRouter({ covered: true })
    )
    expect(plain?.env).toEqual({ ORCA_PANE_KEY: 'tab-1:leaf-1' })
    expect(plain?.envToDelete).toContain('CLAUDE_CONFIG_DIR')

    const own = await applyClaudeLaunchAccount(
      { ...routed, ORCA_CLAUDE_LAUNCH_ACCOUNT: 'b' },
      host,
      settings,
      makeRouter({ covered: true, own: '/Users/me/.claude-own' })
    )
    expect(own?.env.CLAUDE_CONFIG_DIR).toBe('/Users/me/.claude-own')
  })

  it('refuses rather than run another account', async () => {
    const named = { ...routed, ORCA_CLAUDE_LAUNCH_ACCOUNT: 'gone' }
    await expect(applyClaudeLaunchAccount(named, host, settings, makeRouter())).rejects.toThrow(
      'no longer on this host'
    )
    const wsl = { ...routed, ORCA_CLAUDE_LAUNCH_ACCOUNT: 'b' }
    await expect(
      applyClaudeLaunchAccount(wsl, { runtime: 'wsl', wslDistro: 'Ubuntu' }, settings, makeRouter())
    ).rejects.toThrow('cannot start Claude with another account')
    await expect(applyClaudeLaunchAccount(wsl, host, settings, undefined)).rejects.toThrow(
      'cannot start Claude with another account'
    )
  })
})

const roots: string[] = []
afterEach(() => {
  installClaudeProfileRouter(undefined)
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }))
})

function signIn(stateDir: string, email: string): void {
  mkdirSync(stateDir, { recursive: true })
  writeFileSync(
    join(stateDir, '.claude.json'),
    JSON.stringify({ oauthAccount: { emailAddress: email } })
  )
}

/** Accounts a (selected) and b on a real router, each set up in its own folder. */
function twoAccounts() {
  const root = mkdtempSync(join(tmpdir(), 'claude-launch-account-'))
  roots.push(root)
  const userHome = join(root, 'personal')
  const account = (id: string): ClaudeManagedAccount => ({
    id,
    email: `${id}@example.test`,
    authMethod: 'subscription-oauth',
    managedAuthPath: '/unused-legacy',
    createdAt: 0,
    updatedAt: 0,
    lastAuthenticatedAt: 0
  })
  const settings: ClaudeProfileRouterSettings = {
    claudeManagedAccounts: [account('a'), account('b')],
    activeClaudeManagedAccountId: 'a',
    activeClaudeManagedAccountIdsByRuntime: undefined,
    agentStatusHooksEnabled: false,
    disabledTuiAgents: []
  }
  const runSetup = vi.fn(async () => ({ outcome: 'prepared' as const, warnings: [], surfaces: {} }))
  const router = new ClaudeProfileRouter({
    getSettings: () => settings,
    dataRoot: join(root, 'data'),
    userHome,
    env: {},
    runSetup
  })
  for (const id of ['a', 'b']) {
    mkdirSync(router.accountHome(id), { recursive: true })
    writeFileSync(join(router.accountHome(id), '..', 'profile.json'), '{}')
  }
  installClaudeProfileRouter(router)
  return { router, settings, userHome, runSetup }
}

describe('a launch account on the host router', () => {
  it('runs b while a stays the selection of every other pane', async () => {
    const f = twoAccounts()
    signIn(f.router.accountHome('a'), 'a@example.test')
    signIn(f.router.accountHome('b'), 'b@example.test')
    const pane = withClaudeProfileTerminalEnv<Record<string, string>>({}, { runtime: 'host' })
    expect(pane.CLAUDE_CONFIG_DIR).toBe(f.router.accountHome('a'))

    const result = await applyClaudeLaunchAccount(
      { ...pane, ORCA_CLAUDE_LAUNCH_ACCOUNT: 'b' },
      { runtime: 'host' },
      () => f.settings
    )
    expect(result?.env).toEqual({ CLAUDE_CONFIG_DIR: f.router.accountHome('b') })
    expect(f.runSetup).toHaveBeenCalledWith(
      expect.objectContaining({ profile: expect.objectContaining({ accountId: 'b' }) })
    )
    expect(
      withClaudeProfileTerminalEnv<Record<string, string>>({}, { runtime: 'host' })
        .CLAUDE_CONFIG_DIR
    ).toBe(f.router.accountHome('a'))
  })

  it('runs System default for an account only it is signed in to', async () => {
    const f = twoAccounts()
    signIn(f.router.accountHome('a'), 'a@example.test')
    signIn(f.userHome, 'b@example.test')
    const result = await applyClaudeLaunchAccount(
      { ORCA_CLAUDE_LAUNCH_ACCOUNT: 'b' },
      { runtime: 'host' },
      () => f.settings
    )
    expect(result?.env).toEqual({})
    expect(result?.envToDelete).toContain('CLAUDE_CONFIG_DIR')
  })
})
