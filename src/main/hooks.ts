import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { parseOrcaYaml } from '../shared/orca-yaml'
import { resolveHookCommandSourcePolicy } from '../shared/hook-command-source-policy'
import { getEffectiveHooksFromConfig } from './effective-hook-config'
import { getHookRuntimeTarget, getHookWslContext } from './hook-runtime-target'
import { getSetupEnvVars } from './setup-hook-env-vars'
import { iterateLfScriptLines } from './setup-runner-script-text'
import { runOrcaYamlCommand } from './orca-yaml-command-runner'
import type { HookRuntimeTarget } from './hook-runtime-target'
import type { OrcaHooks } from '../shared/orca-yaml-hook-types'
import type { Repo } from '../shared/repo-types'
import type { ProjectExecutionRuntimeResolution } from '../shared/project-execution-runtime'

const HOOK_TIMEOUT = 120_000 // 2 minutes

type HookProcessOutcome = { success: boolean; output: string; exitCode?: number }

/**
 * Turn a finished process into a hook verdict.
 *
 * Why `timedOut` decides before `code` (#19334): a hook that traps SIGTERM and exits 0 reports a
 * zero exit for a run we cut off mid-archive. The exit code of something we stopped is not
 * evidence it finished, so a timeout withholds the code and the removal gate reads that as
 * `unverifiable` rather than as a pass.
 */
function classifyHookProcessResult(
  result: { code: number | null; stdout: string; stderr: string; timedOut: boolean },
  context: { hookName: string; cwd: string; timeoutMs: number }
): HookProcessOutcome {
  const streams = `${result.stdout}\n${result.stderr}`
  if (result.timedOut) {
    const message = `Hook timed out after ${context.timeoutMs}ms.`
    console.error(`[hooks] ${context.hookName} hook failed in ${context.cwd}:`, message)
    return { success: false, output: `${streams}\n${message}`.trim() }
  }
  if (result.code !== 0) {
    // `null` means signalled: there is no exit code, and saying "exit code null" reads as a
    // reporting glitch rather than the `unverifiable` verdict the gate is about to give it.
    const message =
      result.code === null
        ? 'Command was terminated without reporting an exit code.'
        : `Command failed with exit code ${result.code}.`
    console.error(`[hooks] ${context.hookName} hook failed in ${context.cwd}:`, message)
    return {
      success: false,
      output: `${streams}\n${message}`.trim(),
      ...(typeof result.code === 'number' ? { exitCode: result.code } : {})
    }
  }
  console.log(`[hooks] ${context.hookName} hook completed in ${context.cwd}`)
  return { success: true, output: streams.trim() }
}

/**
 * `exec` capped output at 1 MiB and killed the hook on overflow; `spawn` has no cap at all, and a
 * hook flooding stdout for the full deadline can take the main process's heap with it. Truncation
 * is reported in the output rather than as a failure — a chatty hook that exits 0 did succeed, and
 * failing it for being chatty is the `exec` behaviour this is replacing.
 */
const HOOK_OUTPUT_LIMIT_BYTES = 10 * 1024 * 1024

/** A spawn failure: the process never started, so no exit was ever observed. */
function hookProcessError(
  error: Error,
  stdout: string,
  stderr: string,
  context: { hookName: string; cwd: string }
): HookProcessOutcome {
  const code = 'code' in error ? error.code : undefined
  console.error(`[hooks] ${context.hookName} hook failed in ${context.cwd}:`, error.message)
  return {
    success: false,
    output: `${stdout}\n${stderr}\n${error.message}`.trim(),
    ...(typeof code === 'number' ? { exitCode: code } : {})
  }
}

/** A hook that never started reported no exit, so the code stays withheld. */
function hookSpawnFailure(
  error: unknown,
  context: { hookName: string; cwd: string }
): HookProcessOutcome {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[hooks] ${context.hookName} hook failed in ${context.cwd}:`, message)
  return { success: false, output: message }
}

export { parseOrcaYaml }

/**
 * Load hooks from orca.yaml in the given repo root.
 */
export function loadHooks(repoPath: string): OrcaHooks | null {
  const yamlPath = join(repoPath, 'orca.yaml')
  if (!existsSync(yamlPath)) {
    return null
  }

  try {
    const content = readFileSync(yamlPath, 'utf-8')
    return parseOrcaYaml(content)
  } catch {
    return null
  }
}

/**
 * Check whether an orca.yaml exists for a repo.
 */
export function hasHooksFile(repoPath: string): boolean {
  return existsSync(join(repoPath, 'orca.yaml'))
}

// Why: detect unrecognised keys so the UI can suggest an update instead of showing a "could not be parsed" error.
const RECOGNIZED_ORCA_YAML_KEYS = new Set([
  'scripts',
  'setupAgentStartupPolicy',
  'issueCommand',
  'defaultTabs',
  'environmentRecipes',
  'worktree',
  'services'
])

/** True when `orca.yaml` has a top-level key this version of Orca does not handle. */
export function hasUnrecognizedOrcaYamlKeys(repoPath: string): boolean {
  try {
    const content = readFileSync(join(repoPath, 'orca.yaml'), 'utf-8')
    for (const line of iterateLfScriptLines(content)) {
      // Why: match bare `key:` at end-of-line too, since a mapping with a block value on the next line is valid YAML.
      const m = line.match(/^([A-Za-z][A-Za-z0-9_-]*):(\s|$)/)
      if (m != null && !RECOGNIZED_ORCA_YAML_KEYS.has(m[1])) {
        return true
      }
    }
    return false
  } catch {
    return false
  }
}

export function getEffectiveHooks(repo: Repo, worktreePath?: string): OrcaHooks | null {
  const hooksRoot = worktreePath ?? repo.path
  return getEffectiveHooksFromConfig(repo, loadHooks(hooksRoot))
}

export function getSetupCommandSource(
  repo: Repo,
  worktreePath?: string
): { source: 'yaml' | 'local' | 'both'; command: string } | null {
  const hooksRoot = worktreePath ?? repo.path
  const yamlHooks = loadHooks(hooksRoot)
  const yamlSetup = yamlHooks?.scripts.setup?.trim()
  const localSetup = repo.hookSettings?.scripts.setup?.trim()
  const rawPolicy = repo.hookSettings?.commandSourcePolicy
  const policy = resolveHookCommandSourcePolicy(rawPolicy, {
    hasLocalScript: Boolean(localSetup)
  })

  if (policy === 'local-only') {
    return localSetup ? { source: 'local', command: localSetup } : null
  }

  if (policy === 'run-both' && yamlSetup && localSetup) {
    return { source: 'both', command: `${yamlSetup}\n${localSetup}` }
  }

  if (yamlSetup) {
    return { source: 'yaml', command: yamlSetup }
  }

  return null
}

/**
 * Run a named hook script in the given working directory.
 */
export function runHook(
  hookName: 'setup' | 'archive',
  cwd: string,
  repo: Repo,
  hooksPath?: string,
  projectRuntime?: ProjectExecutionRuntimeResolution | HookRuntimeTarget,
  /** Deadline override. Production uses HOOK_TIMEOUT; tests use it to exercise the timeout path. */
  timeoutMs: number = HOOK_TIMEOUT
  // Why (#19334): an absent exitCode means no exit was ever observed. The archive-hook removal
  // gate reads that as `unverifiable` rather than folding it into a zero.
): Promise<{ success: boolean; output: string; exitCode?: number }> {
  const hooks = getEffectiveHooks(repo, hooksPath)
  const script = hooks?.scripts[hookName]

  if (!script) {
    return Promise.resolve({ success: true, output: '' })
  }

  const runtimeTarget = getHookRuntimeTarget(projectRuntime)
  const wslInfo = getHookWslContext(cwd, runtimeTarget)

  return runOrcaYamlCommand(script, {
    cwd,
    pathEnv: getSetupEnvVars(repo, cwd),
    wsl: wslInfo,
    timeoutMs,
    maxOutputBytes: HOOK_OUTPUT_LIMIT_BYTES
  }).then((result) => {
    if (result.spawnError) {
      // A hook that never started reported no exit, so the code stays withheld.
      return wslInfo
        ? hookSpawnFailure(result.spawnError, { hookName, cwd })
        : hookProcessError(result.spawnError, result.stdout, result.stderr, { hookName, cwd })
    }
    // A timed-out run keeps what it printed: the only clue to why the removal gate says
    // `unverifiable`.
    return classifyHookProcessResult(result, { hookName, cwd, timeoutMs })
  })
}
