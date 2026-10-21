import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ClaudeManagedAccount } from '../../shared/managed-account-types'
import { CLAUDE_PROFILE_MISSING_MESSAGE } from '../../shared/claude-profile-routing'
import { getManagedScriptFileName } from '../claude/hook-settings'
import { resolveExternalClaudeConfigDir } from './claude-external-config-dir'
import { claudeProfileMarkerPath, type ClaudeProfileDescriptor } from './claude-profile-paths'
import { ClaudeProfileRouter, type ClaudeProfileRouterSettings } from './claude-profile-router'
import {
  provisionClaudeAccountProfile,
  type ClaudeProfileSetupReport
} from './claude-profile-setup'

vi.mock('../startup/login-shell-environment', () => ({
  resolveLoginShellEnvironment: () => Promise.resolve({})
}))
vi.mock('../macos-keychain/generic-password', () => ({
  execSecurityCommand: async () => {
    throw new Error('The test must never reach the real Keychain.')
  }
}))

const roots: string[] = []
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })))

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'claude-external-'))
  roots.push(root)
  const userHome = join(root, 'personal')
  const dataRoot = join(root, 'data')
  const work = join(root, 'work')
  mkdirSync(join(userHome, '.claude'), { recursive: true })
  mkdirSync(work)
  writeFileSync(
    join(work, '.claude.json'),
    JSON.stringify({ oauthAccount: { emailAddress: 'work@example.test' } })
  )
  const account: ClaudeManagedAccount = {
    id: 'work',
    email: 'work@example.test',
    authMethod: 'subscription-oauth',
    managedAuthPath: work,
    managedAuthRuntime: 'host',
    externalConfigDir: work,
    createdAt: 0,
    updatedAt: 0,
    lastAuthenticatedAt: 0
  }
  const settings: ClaudeProfileRouterSettings = {
    claudeManagedAccounts: [account],
    activeClaudeManagedAccountId: 'work',
    activeClaudeManagedAccountIdsByRuntime: undefined,
    agentStatusHooksEnabled: false,
    disabledTuiAgents: []
  }
  const setups: ClaudeProfileDescriptor[] = []
  const router = new ClaudeProfileRouter({
    getSettings: () => settings,
    dataRoot,
    userHome,
    env: {},
    runSetup: async ({ profile }) => {
      setups.push(profile)
      return { outcome: 'prepared', warnings: [], surfaces: {} } satisfies ClaudeProfileSetupReport
    },
    refreshWaitMs: 50
  })
  return { root, userHome, dataRoot, work, router, setups }
}

describe('resolveExternalClaudeConfigDir', () => {
  it('expands ~ and normalizes the spelling launches pass', () => {
    const f = fixture()
    mkdirSync(join(f.userHome, '.claude-work'))
    const context = { dataRoot: f.dataRoot, userHome: f.userHome }
    expect(resolveExternalClaudeConfigDir(' ~/.claude-work/ ', context)).toBe(
      join(f.userHome, '.claude-work')
    )
    expect(resolveExternalClaudeConfigDir(`${f.work}/`, context)).toBe(f.work)
  })

  it('refuses a relative, missing, Orca-owned or System default folder', () => {
    const f = fixture()
    const context = { dataRoot: f.dataRoot, userHome: f.userHome }
    mkdirSync(join(f.dataRoot, 'claude-profiles', 'x', 'home'), { recursive: true })
    expect(() => resolveExternalClaudeConfigDir('work', context)).toThrow('absolute path')
    expect(() => resolveExternalClaudeConfigDir(join(f.root, 'gone'), context)).toThrow('no folder')
    expect(() =>
      resolveExternalClaudeConfigDir(join(f.dataRoot, 'claude-profiles', 'x', 'home'), context)
    ).toThrow("Orca's own")
    expect(() => resolveExternalClaudeConfigDir('~/.claude', context)).toThrow('System default')
    expect(() => resolveExternalClaudeConfigDir('~', context)).toThrow('System default')
    expect(() =>
      resolveExternalClaudeConfigDir(f.work, { ...context, userConfigDir: f.work })
    ).toThrow('System default')
  })
})

describe('ClaudeProfileRouter with a folder the user signed in to', () => {
  it('routes launches to the folder without waiting on a marker', async () => {
    const f = fixture()
    const preparation = await f.router.prepareLaunch()
    expect(preparation).toMatchObject({ configDir: f.work, provenance: 'profile:work' })
    expect(preparation.envPatch).toMatchObject({ CLAUDE_CONFIG_DIR: f.work })
    expect(f.setups.at(-1)).toMatchObject({ home: f.work, external: true })
    expect(f.router.accountLogin('work')).toMatchObject({ email: 'work@example.test' })
    expect(f.router.accountHomes()).toContain(f.work)
    expect(existsSync(join(f.dataRoot, 'claude-profiles', 'work'))).toBe(false)
  })

  it('refuses to fall back to another account when the folder is gone', () => {
    const f = fixture()
    rmSync(f.work, { recursive: true })
    expect(() => f.router.routedHome()).toThrow(CLAUDE_PROFILE_MISSING_MESSAGE)
  })

  it("keeps the folder and the user's hooks on removal, taking out only Orca's", async () => {
    const f = fixture()
    const userHook = { type: 'command', command: 'echo mine' }
    const orcaHook = {
      type: 'command',
      command: `/home/u/.orca/agent-hooks/${getManagedScriptFileName()}`
    }
    writeFileSync(
      join(f.work, 'settings.json'),
      JSON.stringify({ model: 'opus', hooks: { Stop: [{ hooks: [userHook, orcaHook] }] } })
    )
    await f.router.removeAccount('work')
    expect(existsSync(join(f.work, '.claude.json'))).toBe(true)
    expect(JSON.parse(readFileSync(join(f.work, 'settings.json'), 'utf8'))).toEqual({
      model: 'opus',
      hooks: { Stop: [{ hooks: [userHook] }] }
    })
  })
})

describe('provisionClaudeAccountProfile for a folder the user signed in to', () => {
  it('merges only the hooks there and writes no marker', async () => {
    const f = fixture()
    writeFileSync(join(f.userHome, '.claude', 'settings.json'), '{"model":"default-home"}')
    const profile: ClaudeProfileDescriptor = {
      version: 1,
      accountId: 'work',
      target: { executionHostId: 'local', runtime: 'host' },
      home: f.work,
      external: true
    }
    const installHooks = vi.fn(() => ({
      agent: 'claude' as const,
      state: 'installed' as const,
      configPath: join(f.work, 'settings.json'),
      managedHooksPresent: true,
      detail: null
    }))
    const report = await provisionClaudeAccountProfile({
      dataRoot: f.dataRoot,
      profile,
      userHome: f.userHome,
      installHooks
    })
    expect(report).toMatchObject({ outcome: 'prepared', surfaces: { hooks: 'merged' } })
    expect(installHooks).toHaveBeenCalledWith({ configDir: f.work })
    expect(existsSync(join(f.work, 'settings.json'))).toBe(false)
    expect(existsSync(claudeProfileMarkerPath(profile))).toBe(false)

    const refused = await provisionClaudeAccountProfile({
      dataRoot: f.dataRoot,
      profile,
      userHome: f.userHome,
      userConfigDir: f.work,
      installHooks
    })
    expect(refused.outcome).toBe('refused')
    expect(installHooks).toHaveBeenCalledTimes(1)
  })
})
