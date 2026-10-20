import { createHash } from 'node:crypto'
import { loadHooks } from '../hooks'
import { getHookWslContext } from '../hook-runtime-target'
import { getSetupEnvVars } from '../setup-hook-env-vars'
import { isServicesCommandDisabledByPolicy } from '../../shared/hook-command-source-policy'
import { runOrcaYamlCommand, type OrcaYamlCommandResult } from '../orca-yaml-command-runner'
import type { Repo } from '../../shared/repo-types'
import {
  DEV_SERVICES_API_VERSION,
  DEV_SERVICES_RUN_TIMEOUT_MS,
  DEV_SERVICES_STATUS_TIMEOUT_MS,
  DevServicesRunOutcomeSchema,
  DevServicesStatusSchema,
  type DevServicesRunResponse,
  type DevServicesStatusResponse,
  type DevServicesUnavailableReason
} from '../../shared/dev-services-contract'

// Why so small: the status is one JSON object; anything larger is a broken command, not a status.
const DEV_SERVICES_OUTPUT_LIMIT_BYTES = 1024 * 1024
const STDERR_TAIL_CHARS = 400

export type DevServicesTarget = {
  repo: Repo
  worktreePath: string
  wslDistro?: string | null
}

type Unavailable = Extract<DevServicesStatusResponse, { kind: 'unavailable' }>

export function devServicesUnavailable(
  reason: DevServicesUnavailableReason,
  message: string
): Unavailable {
  return { kind: 'unavailable', reason, message }
}

/** Same digest the renderer's trust store keeps (`hashOrcaHookScript`): SHA-256 of the trimmed text. */
export function hashDevServicesCommand(command: string): string {
  return createHash('sha256').update(command.trim()).digest('hex')
}

function resolveTrustedCommand(repo: Repo, commandHash: string): string | Unavailable {
  // Why here too: the renderer's check binds only this client; any paired client reaches this host.
  if (isServicesCommandDisabledByPolicy(repo.hookSettings?.commandSourcePolicy)) {
    return devServicesUnavailable('disabled', 'This repository runs only local commands.')
  }
  // Why the repo root, not the worktree: one launcher serves every worktree, including branches
  // that predate the command.
  const command = loadHooks(repo.path)?.services?.command
  if (!command) {
    return devServicesUnavailable('no-services', 'orca.yaml has no services command.')
  }
  // Why re-checked here: the user trusted a specific command; an edited orca.yaml must ask again.
  if (hashDevServicesCommand(command) !== commandHash) {
    return devServicesUnavailable('command-changed', 'The services command in orca.yaml changed.')
  }
  return command
}

function runCommand(
  command: string,
  target: DevServicesTarget,
  verb: string,
  args: readonly string[],
  timeoutMs: number,
  signal?: AbortSignal
): Promise<OrcaYamlCommandResult> {
  return runOrcaYamlCommand(command, {
    cwd: target.worktreePath,
    pathEnv: getSetupEnvVars(target.repo, target.worktreePath),
    // Why env, never the script text: verbs and ids would otherwise need shell quoting per platform.
    env: {
      ORCA_SERVICES_API: String(DEV_SERVICES_API_VERSION),
      ORCA_SERVICES_VERB: verb,
      ORCA_SERVICES_ARGS: JSON.stringify(args)
    },
    wsl: getHookWslContext(
      target.worktreePath,
      target.wslDistro ? { wslDistro: target.wslDistro } : undefined
    ),
    timeoutMs,
    maxOutputBytes: DEV_SERVICES_OUTPUT_LIMIT_BYTES,
    signal
  })
}

/** The one JSON object the command printed; tolerates log lines before it. */
export function parseCommandJson(stdout: string): unknown {
  const trimmed = stdout.trim()
  if (!trimmed) {
    return undefined
  }
  try {
    return JSON.parse(trimmed)
  } catch {
    const lastLine = trimmed.slice(trimmed.lastIndexOf('\n') + 1).trim()
    if (!lastLine.startsWith('{')) {
      return undefined
    }
    try {
      return JSON.parse(lastLine)
    } catch {
      return undefined
    }
  }
}

type Interrupted = { kind: 'failed' | 'unverifiable'; message: string }

function interruption(result: OrcaYamlCommandResult, timeoutMs: number): Interrupted | null {
  if (result.spawnError) {
    return { kind: 'failed', message: result.spawnError.message }
  }
  if (result.timedOut) {
    return {
      kind: 'unverifiable',
      message: `The services command did not answer within ${Math.round(timeoutMs / 1000)} s.`
    }
  }
  if (result.aborted) {
    return { kind: 'unverifiable', message: 'The services request was cancelled.' }
  }
  return null
}

function unreadable(result: OrcaYamlCommandResult, detail: string): Interrupted {
  const stderr = result.stderr.trim()
  const tail = stderr.length > STDERR_TAIL_CHARS ? `…${stderr.slice(-STDERR_TAIL_CHARS)}` : stderr
  const exit = result.code === null ? '' : ` (exit code ${result.code})`
  return { kind: 'failed', message: `${detail}${exit}${tail ? `: ${tail}` : ''}` }
}

function apiMismatch(api: number): Interrupted | null {
  return api === DEV_SERVICES_API_VERSION
    ? null
    : {
        kind: 'failed',
        message: `The services command speaks contract v${api}; this Orca reads v${DEV_SERVICES_API_VERSION}.`
      }
}

export function toStatusResponse(result: OrcaYamlCommandResult): DevServicesStatusResponse {
  const interrupted = interruption(result, DEV_SERVICES_STATUS_TIMEOUT_MS)
  if (interrupted) {
    return interrupted
  }
  const parsed = DevServicesStatusSchema.safeParse(parseCommandJson(result.stdout))
  if (!parsed.success) {
    return unreadable(result, 'The services command printed no readable status')
  }
  return apiMismatch(parsed.data.api) ?? { kind: 'status', status: parsed.data }
}

export function toRunResponse(result: OrcaYamlCommandResult): DevServicesRunResponse {
  const interrupted = interruption(result, DEV_SERVICES_RUN_TIMEOUT_MS)
  if (interrupted) {
    return interrupted
  }
  const parsed = DevServicesRunOutcomeSchema.safeParse(parseCommandJson(result.stdout))
  if (!parsed.success) {
    return unreadable(result, 'The services command printed no readable result')
  }
  return apiMismatch(parsed.data.api) ?? { kind: 'done', outcome: parsed.data }
}

type SharedStatus = {
  promise: Promise<DevServicesStatusResponse>
  controller: AbortController
  waiters: number
}

const statusInFlight = new Map<string, SharedStatus>()
const runQueues = new Map<string, Promise<unknown>>()

const CANCELLED: DevServicesStatusResponse = {
  kind: 'unverifiable',
  message: 'The services request was cancelled.'
}

/**
 * One status run per worktree at a time, shared by every caller (two clients polling, a click and a
 * poll). The run is cancelled only when every caller waiting on it has gone.
 */
export function readDevServicesStatus(
  target: DevServicesTarget,
  commandHash: string,
  signal?: AbortSignal
): Promise<DevServicesStatusResponse> {
  const command = resolveTrustedCommand(target.repo, commandHash)
  if (typeof command !== 'string') {
    return Promise.resolve(command)
  }
  const key = target.worktreePath
  let shared = statusInFlight.get(key)
  if (!shared) {
    const controller = new AbortController()
    const promise = runCommand(
      command,
      target,
      'status',
      [],
      DEV_SERVICES_STATUS_TIMEOUT_MS,
      controller.signal
    )
      .then(toStatusResponse)
      .finally(() => {
        if (statusInFlight.get(key)?.promise === promise) {
          statusInFlight.delete(key)
        }
      })
    shared = { promise, controller, waiters: 0 }
    statusInFlight.set(key, shared)
  }
  const entry = shared
  entry.waiters += 1
  if (!signal) {
    return entry.promise
  }
  return new Promise<DevServicesStatusResponse>((resolve) => {
    const leave = (): void => {
      entry.waiters -= 1
      if (entry.waiters === 0) {
        entry.controller.abort()
      }
      resolve(CANCELLED)
    }
    if (signal.aborted) {
      leave()
      return
    }
    signal.addEventListener('abort', leave, { once: true })
    void entry.promise.then((response) => {
      signal.removeEventListener('abort', leave)
      resolve(response)
    })
  })
}

/**
 * Actions on one worktree run one after another, so a double click or two clients cannot start the
 * same stack twice. Never cancelled by a caller: a start cut off midway leaves services in an unknown
 * state; the long deadline only ends a hung command.
 */
export function runDevServicesVerb(
  target: DevServicesTarget,
  commandHash: string,
  verb: string,
  args: readonly string[]
): Promise<DevServicesRunResponse> {
  const command = resolveTrustedCommand(target.repo, commandHash)
  if (typeof command !== 'string') {
    return Promise.resolve(command)
  }
  const key = target.worktreePath
  const previous = runQueues.get(key) ?? Promise.resolve()
  const next = previous
    .catch(() => undefined)
    .then(() => runCommand(command, target, verb, args, DEV_SERVICES_RUN_TIMEOUT_MS))
    .then(toRunResponse)
  runQueues.set(key, next)
  void next.finally(() => {
    if (runQueues.get(key) === next) {
      runQueues.delete(key)
    }
  })
  return next
}
