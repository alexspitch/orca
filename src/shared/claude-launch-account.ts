/**
 * Names the one Claude account a new pane runs instead of its host's selection. The client sets
 * it on the pane's startup env; the host resolves the account's folder and drops it.
 */
export const CLAUDE_LAUNCH_ACCOUNT_ENV = 'ORCA_CLAUDE_LAUNCH_ACCOUNT'

/** Claude's launch env naming `accountId`; other agents and unnamed launches keep theirs. */
export function withClaudeLaunchAccount<Env extends Record<string, string> | undefined>(
  env: Env,
  agent: string,
  accountId: string | undefined
): Env | Record<string, string> {
  return agent === 'claude' && accountId ? { ...env, [CLAUDE_LAUNCH_ACCOUNT_ENV]: accountId } : env
}

/** The account a launch's env names, as `accountEnv` for a host-built agent session; none, none. */
export function claudeLaunchAccountEnv(env: Readonly<Record<string, string>> | undefined): {
  accountEnv?: Record<string, string>
} {
  const accountId = env?.[CLAUDE_LAUNCH_ACCOUNT_ENV]
  return accountId ? { accountEnv: { [CLAUDE_LAUNCH_ACCOUNT_ENV]: accountId } } : {}
}
