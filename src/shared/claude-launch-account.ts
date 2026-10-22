/**
 * Names the one Claude account a new pane runs instead of its host's selection. The client sets
 * it on the pane's startup env; the host resolves the account's folder and drops it.
 */
export const CLAUDE_LAUNCH_ACCOUNT_ENV = 'ORCA_CLAUDE_LAUNCH_ACCOUNT'

/** The account a launch's env names, as `accountEnv` for a host-built agent session; none, none. */
export function claudeLaunchAccountEnv(env: Readonly<Record<string, string>> | undefined): {
  accountEnv?: Record<string, string>
} {
  const accountId = env?.[CLAUDE_LAUNCH_ACCOUNT_ENV]
  return accountId ? { accountEnv: { [CLAUDE_LAUNCH_ACCOUNT_ENV]: accountId } } : {}
}
