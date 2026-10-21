import { resolve } from 'node:path'
import type { HandlerContext } from '../dispatch'
import { printResult } from '../format'
import { RuntimeClientError, type RuntimeClient, type RuntimeRpcSuccess } from '../runtime-client'
import {
  CLAUDE_ACCOUNT_LABEL_RUNTIME_CAPABILITY,
  CLAUDE_FOLDER_ACCOUNT_RUNTIME_CAPABILITY
} from '../../shared/account-runtime-capabilities'
import type { RuntimeStatus } from '../../shared/runtime-types'
import type { ClaudeRateLimitAccountsState } from '../../shared/managed-account-types'
import { formatAccountsBlock } from './account-list-format'

export type ClaudeAccountAddOptions = { configDir?: string; label?: string }

/** `--config-dir` and `--label` of `orca account add`; for other agents `--label` is theirs. */
export function readClaudeAccountAddOptions(
  { flags }: HandlerContext,
  agent: string
): ClaudeAccountAddOptions {
  const configDir = flags.get('config-dir')
  if (configDir !== undefined && (typeof configDir !== 'string' || agent !== 'claude')) {
    throw new RuntimeClientError(
      'invalid_argument',
      '--config-dir takes the path of a signed-in Claude folder and works only with --agent claude.'
    )
  }
  const label = agent === 'claude' ? flags.get('label') : undefined
  if (
    label !== undefined &&
    (typeof label !== 'string' || !label.trim() || label.trim().length > 120)
  ) {
    throw new RuntimeClientError('invalid_argument', '--label must contain 1–120 characters.')
  }
  return { configDir, label: label?.trim() }
}

/** Fails on runtime version skew before a sign-in, so its OAuth round trip is never wasted. */
export async function assertClaudeAccountAddSupported(
  client: RuntimeClient,
  options: ClaudeAccountAddOptions
): Promise<void> {
  const required = [
    ...(options.configDir === undefined ? [] : [CLAUDE_FOLDER_ACCOUNT_RUNTIME_CAPABILITY]),
    ...(options.label === undefined ? [] : [CLAUDE_ACCOUNT_LABEL_RUNTIME_CAPABILITY])
  ]
  if (required.length === 0) {
    return
  }
  const status = await client.call<RuntimeStatus>('status.get')
  if (!required.every((capability) => status.result.capabilities?.includes(capability))) {
    throw new RuntimeClientError(
      'incompatible_runtime',
      'The running Orca runtime is too old to add a Claude account from a folder or with a name. Update or restart Orca and try again.'
    )
  }
}

/** `orca account add --config-dir <dir>`: saves a folder already signed in on this host. */
export async function addClaudeAccountFromFolder(
  { client, cwd, json }: HandlerContext,
  configDir: string,
  label: string | undefined
): Promise<void> {
  // Why resolve here: a relative path means this shell's directory; `~` is expanded by the runtime.
  const target = configDir.startsWith('~') ? configDir : resolve(cwd, configDir)
  const result = await client.call<ClaudeRateLimitAccountsState>(
    'accounts.addClaudeFromFolder',
    { configDir: target, ...(label ? { label } : {}) },
    { timeoutMs: 60_000 }
  )
  printResult(result, json, (state) => formatAccountsBlock('Claude', state))
}

export function nameClaudeAccount(
  client: RuntimeClient,
  accountId: string,
  label: string
): Promise<RuntimeRpcSuccess<ClaudeRateLimitAccountsState>> {
  return client.call<ClaudeRateLimitAccountsState>('accounts.renameClaude', { accountId, label })
}
