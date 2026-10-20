import { spawn } from 'node:child_process'
import {
  forceTerminateProcessTree,
  signalProcessTree
} from '@orca/process-host/process-tree-termination'
import { createOutputSink } from '@orca/process-host/bounded-output-sink'
import { promptGuardShellEnv } from './git/runner'
import { dropIncoherentCondaActivationEnv } from './pty/conda-activation-env'
import { toLinuxPath } from './wsl'
import { runWslProcess } from './wsl/wsl-runner'

const SIGTERM_GRACE_MS = 2_000

export type OrcaYamlCommandResult = {
  /** Null when signalled, cut off, or never started: no exit was observed. */
  code: number | null
  stdout: string
  stderr: string
  timedOut: boolean
  aborted: boolean
  outputTruncated: boolean
  /** The process never started (or its spawn failed). */
  spawnError?: Error
}

export type OrcaYamlCommandOptions = {
  cwd: string
  /** ORCA_* path variables (see getSetupEnvVars); translated to guest paths inside WSL. */
  pathEnv: Readonly<Record<string, string>>
  /** Further variables, passed through unchanged. */
  env?: Readonly<Record<string, string>>
  wsl: { distro: string | null; linuxPath: string } | null
  timeoutMs: number
  maxOutputBytes: number
  /** Native runs only: the WSL runner owns its own deadline and has no cancellation. */
  signal?: AbortSignal
}

export function getHookShell(): string | undefined {
  if (process.platform === 'win32') {
    return process.env.ComSpec || 'cmd.exe'
  }

  return '/bin/bash'
}

/**
 * Run a user-authored orca.yaml script the way hooks always have: the hook shell, the unattended-git
 * guard, a deadline Orca owns, and the whole process tree stopped when it is cut off.
 */
export function runOrcaYamlCommand(
  script: string,
  options: OrcaYamlCommandOptions
): Promise<OrcaYamlCommandResult> {
  return options.wsl ? runInWsl(script, options, options.wsl) : runNative(script, options)
}

async function runInWsl(
  script: string,
  options: OrcaYamlCommandOptions,
  wsl: { distro: string | null; linuxPath: string }
): Promise<OrcaYamlCommandResult> {
  // Why: the script runs inside WSL, so the ORCA_* Windows UNC paths become Linux paths.
  const wslEnv: Record<string, string> = {}
  for (const [key, value] of Object.entries(options.pathEnv)) {
    wslEnv[key] = toLinuxPath(value)
  }
  Object.assign(wslEnv, options.env)
  // Why: same unattended-git guard as the native branch (issue #7652) — only the guard flags and
  // any indexed git-config protocol are meant to reach the guest; askpass stays host-side.
  const guardedEnv = promptGuardShellEnv(wslEnv)
  const guestEnv: Record<string, string> = { ...wslEnv }
  for (const [key, value] of Object.entries(guardedEnv)) {
    if (
      value !== undefined &&
      (key === 'GIT_TERMINAL_PROMPT' || key === 'GCM_INTERACTIVE' || key.startsWith('GIT_CONFIG_'))
    ) {
      guestEnv[key] = value
    }
  }
  try {
    const result = await runWslProcess({
      distro: wsl.distro ?? undefined,
      loginPath: 'preferred',
      script,
      // Why pinned: these are user-authored orca.yaml scripts and the native path runs /bin/bash.
      // Defaulting to sh would fail bash-only scripts on WSL only.
      shell: 'bash',
      cwd: wsl.linuxPath,
      env: guestEnv,
      timeoutMs: options.timeoutMs,
      maxOutputBytes: options.maxOutputBytes
    })
    return {
      code: result.code,
      stdout: result.stdout,
      stderr: result.stderr,
      timedOut: result.timedOut,
      aborted: false,
      outputTruncated: result.outputTruncated === true
    }
  } catch (error) {
    return {
      code: null,
      stdout: '',
      stderr: '',
      timedOut: false,
      aborted: false,
      outputTruncated: false,
      spawnError: error instanceof Error ? error : new Error(String(error))
    }
  }
}

function runNative(
  script: string,
  options: OrcaYamlCommandOptions
): Promise<OrcaYamlCommandResult> {
  const { cwd, timeoutMs, maxOutputBytes, signal } = options
  if (signal?.aborted) {
    return Promise.resolve({
      code: null,
      stdout: '',
      stderr: '',
      timedOut: false,
      aborted: true,
      outputTruncated: false
    })
  }
  const shellEnv: NodeJS.ProcessEnv = { ...process.env, ...options.pathEnv, ...options.env }
  dropIncoherentCondaActivationEnv(shellEnv)

  return new Promise<OrcaYamlCommandResult>((resolve) => {
    // Why we own the deadline (#19334): Node's `exec({ timeout })` SIGTERMs the child and then
    // reports whatever it chose to do, so a script that traps SIGTERM and exits 0 came back as a
    // pass. Settle AT the deadline instead, so a script that keeps running cannot hold a caller.
    let settled = false
    let deadline: NodeJS.Timeout | undefined
    const stdout = createOutputSink(maxOutputBytes)
    const stderr = createOutputSink(maxOutputBytes)
    const readSink = (sink: ReturnType<typeof createOutputSink>): string =>
      sink.truncated()
        ? `${sink.text()}\n[output truncated at ${maxOutputBytes} bytes]`
        : sink.text()
    const snapshot = (
      fields: Pick<OrcaYamlCommandResult, 'code' | 'timedOut' | 'aborted'> & { spawnError?: Error }
    ): OrcaYamlCommandResult => ({
      ...fields,
      stdout: readSink(stdout),
      stderr: readSink(stderr),
      outputTruncated: stdout.truncated() || stderr.truncated()
    })
    const settle = (result: OrcaYamlCommandResult): void => {
      if (settled) {
        return
      }
      settled = true
      if (deadline) {
        clearTimeout(deadline)
      }
      signal?.removeEventListener('abort', onAbort)
      resolve(result)
    }
    // Why `spawn` and not `exec` (#19334 follow-up): `detached` is a spawn-only option, so only
    // here does the shell become a group leader the tree signal below can reach. Passing `shell` as
    // a string keeps Node's own platform invocation: `cmd.exe /d /s /c` on Windows.
    const child = spawn(script, {
      cwd,
      shell: getHookShell(),
      // Why: scripts run unattended; block Git Credential Manager's interactive prompt while
      // keeping cached auth (issue #7652).
      env: promptGuardShellEnv(shellEnv),
      stdio: ['ignore', 'pipe', 'pipe'],
      // Pinned as `runProcess` pins it: a `cmd.exe` script otherwise flashes a console window.
      windowsHide: true,
      // Not on Windows, which has no process groups in this sense and where `detached` means a new
      // console instead.
      ...(process.platform === 'win32' ? {} : { detached: true })
    })
    child.stdout?.on('data', (chunk: Buffer | string) => stdout.write(chunk))
    child.stderr?.on('data', (chunk: Buffer | string) => stderr.write(chunk))
    // Why listeners that do nothing: an unhandled stream `error` is an uncaught exception, and in
    // the Electron main process that is the whole app. Losing output is not worth a crash.
    for (const stream of [child.stdin, child.stdout, child.stderr]) {
      stream?.on('error', () => {})
    }
    child.on('error', (error) => {
      settle(snapshot({ code: null, timedOut: false, aborted: false, spawnError: error }))
    })
    child.on('close', (code, closeSignal) => {
      // A signalled exit reports no code, which stays unverifiable rather than becoming a 0.
      settle(snapshot({ code: closeSignal ? null : code, timedOut: false, aborted: false }))
    })
    const stopTree = (): void => {
      // SIGTERM first so a well-behaved script can clean up; then the whole tree, `taskkill /t /f`
      // on Windows, with the recycled-pid guard.
      void signalProcessTree(child, 'SIGTERM')
      setTimeout(() => {
        void forceTerminateProcessTree(child)
      }, SIGTERM_GRACE_MS).unref?.()
    }
    function onAbort(): void {
      if (settled) {
        return
      }
      settle(snapshot({ code: null, timedOut: false, aborted: true }))
      stopTree()
    }
    // Why guarded: a spawn failure can settle before these are armed, and arming them on a finished
    // run would later signal a pid that is gone — and may by then belong to something else.
    if (!settled) {
      deadline = setTimeout(() => {
        settle(snapshot({ code: null, timedOut: true, aborted: false }))
        stopTree()
      }, timeoutMs)
      signal?.addEventListener('abort', onAbort, { once: true })
    }
  })
}
