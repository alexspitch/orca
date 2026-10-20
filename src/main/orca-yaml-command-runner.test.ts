import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runOrcaYamlCommand, type OrcaYamlCommandOptions } from './orca-yaml-command-runner'

// Real /bin/bash runs: the runner's job is process handling, which a spawn mock cannot show.
describe.skipIf(process.platform === 'win32')('runOrcaYamlCommand', () => {
  let cwd: string

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'orca-yaml-command-'))
  })

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true })
  })

  const options = (overrides: Partial<OrcaYamlCommandOptions> = {}): OrcaYamlCommandOptions => ({
    cwd,
    pathEnv: { ORCA_WORKTREE_PATH: cwd },
    wsl: null,
    timeoutMs: 10_000,
    maxOutputBytes: 1024 * 1024,
    ...overrides
  })

  it('passes path and extra variables through the environment, never the script text', async () => {
    const args = JSON.stringify(['dc', "it's; $(nope)"])
    const result = await runOrcaYamlCommand(
      'printf "%s|%s|%s" "$ORCA_WORKTREE_PATH" "$ORCA_SERVICES_VERB" "$ORCA_SERVICES_ARGS"',
      options({ env: { ORCA_SERVICES_VERB: 'start', ORCA_SERVICES_ARGS: args } })
    )

    expect(result).toMatchObject({ code: 0, timedOut: false, aborted: false })
    expect(result.stdout).toBe(`${cwd}|start|${args}`)
  })

  it('reports a non-zero exit with what the script printed', async () => {
    const result = await runOrcaYamlCommand('echo out; echo err >&2; exit 3', options())

    expect(result).toMatchObject({ code: 3, stdout: 'out\n', stderr: 'err\n', timedOut: false })
  })

  it('caps output and says so', async () => {
    const result = await runOrcaYamlCommand(
      'head -c 4096 /dev/zero | tr "\\0" a',
      options({ maxOutputBytes: 100 })
    )

    expect(result.outputTruncated).toBe(true)
    expect(result.stdout).toContain('[output truncated at 100 bytes]')
  })

  it('settles at the deadline without an exit code', async () => {
    const started = Date.now()
    const result = await runOrcaYamlCommand('echo begun; sleep 30', options({ timeoutMs: 300 }))

    expect(Date.now() - started).toBeLessThan(5_000)
    expect(result).toMatchObject({ code: null, timedOut: true, aborted: false })
    expect(result.stdout).toBe('begun\n')
  })

  it('stops when its caller aborts', async () => {
    const controller = new AbortController()
    const run = runOrcaYamlCommand('sleep 30', options({ signal: controller.signal }))
    setTimeout(() => controller.abort(), 100)

    await expect(run).resolves.toMatchObject({ code: null, timedOut: false, aborted: true })
  })

  it('does not start when already aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    const result = await runOrcaYamlCommand(
      'echo should-not-matter',
      options({ signal: controller.signal })
    )

    expect(result).toMatchObject({ code: null, aborted: true })
  })
})
