import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../shared/repo-types'
import type { OrcaYamlCommandResult } from '../orca-yaml-command-runner'

const { loadHooksMock, runMock } = vi.hoisted(() => ({
  loadHooksMock: vi.fn(),
  runMock: vi.fn()
}))

vi.mock('../hooks', () => ({ loadHooks: loadHooksMock }))
vi.mock('../orca-yaml-command-runner', () => ({ runOrcaYamlCommand: runMock }))

import {
  hashDevServicesCommand,
  parseCommandJson,
  readDevServicesStatus,
  runDevServicesVerb,
  type DevServicesTarget
} from './dev-services-host'

const COMMAND = 'node "$ORCA_ROOT_PATH/utils/orca-run.mjs" orca'
const HASH = hashDevServicesCommand(COMMAND)
// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the host reads only `path` and the setup-env fields of the repo.
const repo = { id: 'repo-1', path: '/srv/main', displayName: 'main' } as Repo
const target: DevServicesTarget = { repo, worktreePath: '/srv/wt-1' }

function finished(stdout: string, overrides: Partial<OrcaYamlCommandResult> = {}) {
  return {
    code: 0,
    stdout,
    stderr: '',
    timedOut: false,
    aborted: false,
    outputTruncated: false,
    ...overrides
  }
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('dev services host', () => {
  beforeEach(() => {
    loadHooksMock.mockReset()
    runMock.mockReset()
    loadHooksMock.mockReturnValue({ scripts: {}, services: { command: COMMAND } })
  })

  it('runs the trusted command in the worktree with the verb and arguments in env', async () => {
    runMock.mockResolvedValue(finished('{"api":1,"ok":true}'))

    await runDevServicesVerb(target, HASH, 'start', ['dc'])

    expect(loadHooksMock).toHaveBeenCalledWith('/srv/main')
    expect(runMock).toHaveBeenCalledWith(
      COMMAND,
      expect.objectContaining({
        cwd: '/srv/wt-1',
        env: {
          ORCA_SERVICES_API: '1',
          ORCA_SERVICES_VERB: 'start',
          ORCA_SERVICES_ARGS: '["dc"]'
        },
        pathEnv: expect.objectContaining({
          ORCA_ROOT_PATH: '/srv/main',
          ORCA_WORKTREE_PATH: '/srv/wt-1'
        })
      })
    )
  })

  it('refuses a command whose hash is not the trusted one', async () => {
    const response = await readDevServicesStatus(target, 'stale-hash')

    expect(response).toMatchObject({ kind: 'unavailable', reason: 'command-changed' })
    expect(runMock).not.toHaveBeenCalled()
  })

  it('reports a repo without a services command', async () => {
    loadHooksMock.mockReturnValue(null)

    await expect(runDevServicesVerb(target, HASH, 'stop', [])).resolves.toMatchObject({
      kind: 'unavailable',
      reason: 'no-services'
    })
  })

  it('reads a status even when the command exits non-zero', async () => {
    runMock.mockResolvedValue(
      finished('log line\n{"api":1,"ok":false,"error":{"code":"x","message":"boom"}}', {
        code: 1
      })
    )

    const response = await readDevServicesStatus(target, HASH)

    expect(response).toMatchObject({
      kind: 'status',
      status: { ok: false, error: { message: 'boom' }, services: [] }
    })
  })

  it('turns unreadable output into a failure with the end of stderr', async () => {
    runMock.mockResolvedValue(finished('not json', { code: 2, stderr: 'Traceback: oops' }))

    await expect(readDevServicesStatus(target, HASH)).resolves.toEqual({
      kind: 'failed',
      message: 'The services command printed no readable status (exit code 2): Traceback: oops'
    })
  })

  it('treats a deadline as unverifiable, not as a failure', async () => {
    runMock.mockResolvedValue(finished('', { code: null, timedOut: true }))

    await expect(runDevServicesVerb(target, HASH, 'start', ['dc'])).resolves.toMatchObject({
      kind: 'unverifiable'
    })
  })

  it('refuses a contract version it cannot read', async () => {
    runMock.mockResolvedValue(finished('{"api":2,"ok":true}'))

    await expect(readDevServicesStatus(target, HASH)).resolves.toMatchObject({ kind: 'failed' })
  })

  it('shares one status run between concurrent callers', async () => {
    const pending = deferred<OrcaYamlCommandResult>()
    runMock.mockReturnValue(pending.promise)

    const first = readDevServicesStatus(target, HASH)
    const second = readDevServicesStatus(target, HASH)
    pending.resolve(finished('{"api":1,"ok":true}'))

    await expect(Promise.all([first, second])).resolves.toHaveLength(2)
    expect(runMock).toHaveBeenCalledTimes(1)
  })

  it('aborts a shared status run only when every caller has gone', async () => {
    const pending = deferred<OrcaYamlCommandResult>()
    runMock.mockReturnValue(pending.promise)
    const first = new AbortController()
    const second = new AbortController()

    const firstRead = readDevServicesStatus(target, HASH, first.signal)
    const secondRead = readDevServicesStatus(target, HASH, second.signal)
    const runSignal: AbortSignal = runMock.mock.calls[0][1].signal
    first.abort()
    await expect(firstRead).resolves.toMatchObject({ kind: 'unverifiable' })
    expect(runSignal.aborted).toBe(false)
    second.abort()
    await expect(secondRead).resolves.toMatchObject({ kind: 'unverifiable' })
    expect(runSignal.aborted).toBe(true)
    pending.resolve(finished('', { code: null, aborted: true }))
  })

  it('runs actions on one worktree one after another', async () => {
    const firstRun = deferred<OrcaYamlCommandResult>()
    runMock.mockReturnValueOnce(firstRun.promise)
    runMock.mockResolvedValueOnce(finished('{"api":1,"ok":true}'))

    const first = runDevServicesVerb(target, HASH, 'start', ['dc'])
    const second = runDevServicesVerb(target, HASH, 'start', ['dc'])
    await vi.waitFor(() => expect(runMock).toHaveBeenCalledTimes(1))
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(runMock).toHaveBeenCalledTimes(1)
    firstRun.resolve(finished('{"api":1,"ok":true}'))
    await Promise.all([first, second])
    expect(runMock).toHaveBeenCalledTimes(2)
  })
})

describe('parseCommandJson', () => {
  it('takes the last line when the command logged before its JSON', () => {
    expect(parseCommandJson('starting\n{"api":1}\n')).toEqual({ api: 1 })
  })

  it('returns undefined for empty or non-JSON output', () => {
    expect(parseCommandJson('')).toBeUndefined()
    expect(parseCommandJson('hello\nworld')).toBeUndefined()
  })
})
