import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as ClaudeHookEventVersions from './claude-hook-event-versions'

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/userData'
  }
}))
vi.mock('./claude-hook-event-versions', async (importOriginal) => ({
  ...(await importOriginal<typeof ClaudeHookEventVersions>()),
  probeRecentClaudeCliVersion: vi.fn(async () => '2.1.261')
}))

import {
  prepareClaudeUserConfigDir,
  readClaudeUserConfigDirs,
  removeClaudeUserConfigDirHooks
} from './claude-user-config-dirs'
import { ClaudeHookService } from './hook-service'

const USER_STATUS_LINE = { type: 'command', command: 'bash ~/.claude/statusline.sh' }

describe('Claude folders the user picked', () => {
  let tmpHome: string
  let userDir: string
  let userSettings: string

  beforeEach(() => {
    tmpHome = mkdtempSync(join(tmpdir(), 'orca-claude-user-dirs-'))
    userDir = join(tmpHome, 'work claude')
    userSettings = join(userDir, 'settings.json')
    mkdirSync(userDir)
    writeFileSync(userSettings, JSON.stringify({ model: 'opus', statusLine: USER_STATUS_LINE }))
    vi.stubEnv('HOME', tmpHome)
    vi.stubEnv('USERPROFILE', tmpHome)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    rmSync(tmpHome, { recursive: true, force: true })
  })

  const readSettings = () => JSON.parse(readFileSync(userSettings, 'utf-8'))
  const enabled = () => true

  it('merges hooks and the usage statusLine in once, and takes both out with Claude hooks', async () => {
    const service = new ClaudeHookService()
    await prepareClaudeUserConfigDir(service, userDir, enabled)
    await prepareClaudeUserConfigDir(service, userDir, enabled)

    const prepared = readSettings()
    expect(prepared.model).toBe('opus')
    expect(prepared.hooks.SessionStart).toBeDefined()
    if (process.platform !== 'win32') {
      expect(prepared.statusLine.command).toContain('agent-hooks/claude-statusline.sh')
    }
    expect(readClaudeUserConfigDirs()).toEqual([userDir])

    removeClaudeUserConfigDirHooks()
    expect(readSettings()).toEqual({ model: 'opus', statusLine: USER_STATUS_LINE, hooks: {} })
    expect(readClaudeUserConfigDirs()).toEqual([])
  })

  it('leaves alone a folder it must not edit', async () => {
    const service = new ClaudeHookService()
    const before = readFileSync(userSettings, 'utf-8')
    await prepareClaudeUserConfigDir(service, userDir, () => false)
    await prepareClaudeUserConfigDir(service, 'relative/claude', enabled)
    await prepareClaudeUserConfigDir(service, join(tmpHome, 'missing'), enabled)
    expect(existsSync(join(tmpHome, 'missing'))).toBe(false)
    // System default's own home is the default install's, never a user folder.
    mkdirSync(join(tmpHome, '.claude'))
    await prepareClaudeUserConfigDir(service, join(tmpHome, '.claude'), enabled)

    expect(readFileSync(userSettings, 'utf-8')).toBe(before)
    expect(existsSync(join(tmpHome, '.claude', 'settings.json'))).toBe(false)
    expect(readClaudeUserConfigDirs()).toEqual([])
  })
})
