import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  SESSION_TRANSCRIPT_MESSAGE_CHARS,
  SESSION_TRANSCRIPT_PAGE_MESSAGES
} from '../../shared/build-web-session-transcript'
import { readBuildWebSessionTranscript } from './build-web-session-transcript'

const SESSION = '0b6d7c1e-4f3a-4b1e-9d1c-2a7f5e8b9c10'

let root: string
let claudeProjectsDir: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'orca-session-transcript-'))
  claudeProjectsDir = join(root, 'claude', 'projects')
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

const line = (role: 'user' | 'assistant', text: string, at: number): string =>
  JSON.stringify({
    type: role,
    uuid: `${role}-${at}`,
    timestamp: new Date(Date.UTC(2026, 9, 28, 10, 0, at)).toISOString(),
    message: { role, content: role === 'user' ? text : [{ type: 'text', text }] }
  })

async function writeLog(lines: string[]): Promise<void> {
  const projectDir = join(claudeProjectsDir, '-srv-orca-workspaces-is-147')
  await mkdir(projectDir, { recursive: true })
  await writeFile(join(projectDir, `${SESSION}.jsonl`), `${lines.join('\n')}\n`)
}

describe('a task session’s log through its host', () => {
  it('pages from the end and clips each message, so a page fits one frame', async () => {
    const total = SESSION_TRANSCRIPT_PAGE_MESSAGES + 20
    await writeLog(
      Array.from({ length: total }, (_, i) =>
        line(i % 2 ? 'assistant' : 'user', i === total - 1 ? 'x'.repeat(10_000) : `m${i}`, i)
      )
    )
    const args = { agent: 'claude', providerSessionId: SESSION }
    const last = await readBuildWebSessionTranscript(args, { claudeProjectsDir })
    expect(last.kind).toBe('found')
    if (last.kind !== 'found') {
      return
    }
    expect(last.text.startsWith('[user] m20')).toBe(true)
    expect(last.text).toContain('… (clipped)')
    expect(last.text.length).toBeLessThan(
      SESSION_TRANSCRIPT_PAGE_MESSAGES * (SESSION_TRANSCRIPT_MESSAGE_CHARS + 40)
    )
    expect(last.before).not.toBeNull()

    const first = await readBuildWebSessionTranscript(
      { ...args, before: last.before ?? undefined },
      { claudeProjectsDir }
    )
    expect(first).toMatchObject({ kind: 'found', before: null })
    expect(first.kind === 'found' && first.text.split('\n\n')).toHaveLength(20)
  })

  it('says the log is gone, with how long Claude keeps logs on this host', async () => {
    const args = { agent: 'claude', providerSessionId: SESSION }
    await expect(readBuildWebSessionTranscript(args, { claudeProjectsDir })).resolves.toEqual({
      kind: 'missing',
      retentionDays: 30
    })
    await mkdir(join(root, 'claude'), { recursive: true })
    await writeFile(join(root, 'claude', 'settings.json'), '{"cleanupPeriodDays": 7}')
    await expect(readBuildWebSessionTranscript(args, { claudeProjectsDir })).resolves.toEqual({
      kind: 'missing',
      retentionDays: 7
    })
  })

  it('refuses an agent whose log it cannot read', async () => {
    await expect(
      readBuildWebSessionTranscript({ agent: 'aider', providerSessionId: SESSION })
    ).resolves.toEqual({ kind: 'unsupported' })
  })
})
