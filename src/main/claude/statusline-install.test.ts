import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/userData'
  }
}))

import { removeExternalClaudeProfileHooks } from '../claude-accounts/claude-external-config-dir'
import { ClaudeHookService } from './hook-service'
import { readWrappedUserStatusLineCommand } from './statusline-install'

const CURRENT_CLAUDE = { claudeVersion: '2.1.261' }
// Why a quote inside: the wrapper stores the command shell-quoted and must give it back verbatim.
const USER_STATUS_LINE = {
  type: 'command',
  command: `printf "it's %s\\n" "$(/bin/cat)"`,
  padding: 0
}

describe('Claude statusLine wrapping a user command', () => {
  let tmpHome: string
  let settingsPath: string

  beforeEach(() => {
    tmpHome = mkdtempSync(join(tmpdir(), 'orca-claude-user-statusline-'))
    settingsPath = join(tmpHome, '.claude', 'settings.json')
    vi.stubEnv('HOME', tmpHome)
    vi.stubEnv('USERPROFILE', tmpHome)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    rmSync(tmpHome, { recursive: true, force: true })
  })

  const readSettings = (path = settingsPath) => JSON.parse(readFileSync(path, 'utf-8'))
  const writeSettings = (path: string, value: unknown) => {
    mkdirSync(join(path, '..'), { recursive: true })
    writeFileSync(path, JSON.stringify(value))
  }
  // Runs the statusLine the way Claude does: its command under a shell, the payload on stdin.
  const runStatusLine = (command: string) =>
    spawnSync('/bin/sh', ['-c', command], {
      input: '{"model":{}}',
      encoding: 'utf8',
      env: { HOME: tmpHome, PATH: '/usr/bin:/bin' }
    })

  it.skipIf(process.platform === 'win32')(
    'runs the user statusLine from the managed one, keeps its output, and puts it back on remove()',
    () => {
      writeSettings(settingsPath, { statusLine: USER_STATUS_LINE })
      new ClaudeHookService().install(CURRENT_CLAUDE)
      // A second install (app restart) must keep the user command, not wrap the wrapper.
      new ClaudeHookService().install(CURRENT_CLAUDE)

      const wrapped = readSettings().statusLine
      expect(wrapped.command).toContain('agent-hooks/claude-statusline.sh')
      expect(wrapped.padding).toBe(0)
      expect(readWrappedUserStatusLineCommand(wrapped.command)).toBe(USER_STATUS_LINE.command)
      const run = runStatusLine(wrapped.command)
      expect(run.stdout).toBe(`it's {"model":{}}\n`)
      expect(run.stderr).toBe('')

      new ClaudeHookService().remove()
      expect(readSettings().statusLine).toEqual(USER_STATUS_LINE)
    }
  )

  it.skipIf(process.platform !== 'win32')('keeps a user statusLine untouched on Windows', () => {
    writeSettings(settingsPath, { statusLine: USER_STATUS_LINE })
    new ClaudeHookService().install(CURRENT_CLAUDE)
    expect(readSettings().statusLine).toEqual(USER_STATUS_LINE)
  })

  it.skipIf(process.platform === 'win32')(
    "installs into the user's own folder, keeps its opt-out apart, and takes it back out",
    () => {
      const userDir = join(tmpHome, 'work-claude')
      const userSettings = join(userDir, 'settings.json')
      writeSettings(userSettings, { statusLine: USER_STATUS_LINE })
      const service = new ClaudeHookService()

      // An Orca profile gets its statusLine from the default home's settings copy instead.
      expect(service.install({ ...CURRENT_CLAUDE, configDir: userDir }).state).toBe('installed')
      expect(readSettings(userSettings).statusLine).toEqual(USER_STATUS_LINE)

      service.install({ ...CURRENT_CLAUDE, configDir: userDir, userFolder: true })
      const wrapped = readSettings(userSettings).statusLine
      expect(readWrappedUserStatusLineCommand(wrapped.command)).toBe(USER_STATUS_LINE.command)
      expect(runStatusLine(wrapped.command).stdout).toBe(`it's {"model":{}}\n`)

      // Deleting it there is that folder's opt-out alone.
      const { statusLine: _deleted, ...rest } = readSettings(userSettings)
      writeFileSync(userSettings, JSON.stringify(rest))
      service.install({ ...CURRENT_CLAUDE, configDir: userDir, userFolder: true })
      expect(readSettings(userSettings).statusLine).toBeUndefined()
      service.install(CURRENT_CLAUDE)
      expect(readSettings().statusLine?.command).toContain('claude-statusline')

      writeFileSync(userSettings, JSON.stringify({ ...rest, statusLine: USER_STATUS_LINE }))
      service.install({ ...CURRENT_CLAUDE, configDir: userDir, userFolder: true })
      removeExternalClaudeProfileHooks(userDir)
      const restored = readSettings(userSettings)
      expect(restored.statusLine).toEqual(USER_STATUS_LINE)
      expect(restored.hooks).toEqual({})
    }
  )
})

describe('readWrappedUserStatusLineCommand', () => {
  it('reads back only a command Orca wrapped', () => {
    expect(readWrappedUserStatusLineCommand(null)).toBeNull()
    expect(readWrappedUserStatusLineCommand('bash ~/.claude/statusline.sh')).toBeNull()
    expect(
      readWrappedUserStatusLineCommand(
        "ORCA_STATUSLINE_USER_COMMAND='a'\\''b'; export ORCA_STATUSLINE_USER_COMMAND; managed"
      )
    ).toBe("a'b")
  })
})
