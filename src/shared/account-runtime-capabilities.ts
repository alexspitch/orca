export const CODEX_RESET_CREDIT_RUNTIME_CAPABILITY = 'accounts.codex-reset-credit.v1' as const
export const ACCOUNT_IMPORT_RUNTIME_CAPABILITY = 'accounts.import-host-credentials.v1' as const
// Why: `orca account add claude` signs in to an account folder the host creates first.
export const CLAUDE_SIGN_IN_RUNTIME_CAPABILITY = 'accounts.claude-sign-in.v1' as const
// Why: `accounts.addClaudeFromFolder` saves a folder already signed in on the host.
export const CLAUDE_FOLDER_ACCOUNT_RUNTIME_CAPABILITY = 'accounts.claude-folder.v1' as const
// Why: `accounts.renameClaude` names an account; older hosts list emails only.
export const CLAUDE_ACCOUNT_LABEL_RUNTIME_CAPABILITY = 'accounts.claude-label.v1' as const
export const ANTIGRAVITY_ACCOUNTS_RUNTIME_CAPABILITY = 'accounts.antigravity-native.v1' as const
// Why separate: a host that serves the terminal accounts may predate the chat sign-in's methods.
export const ANTIGRAVITY_CHAT_SIGN_IN_RUNTIME_CAPABILITY =
  'accounts.antigravity-chat-sign-in.v1' as const
export const DATA_ACCOUNT_RUNTIME_CAPABILITY = 'accounts.managed-data-profiles.v1' as const
// Why: an older host ignores ORCA_CLAUDE_LAUNCH_ACCOUNT and runs its selected account instead.
// v2: a host-built agent session takes it in `accountEnv`; v1 dropped it there.
export const CLAUDE_LAUNCH_ACCOUNT_RUNTIME_CAPABILITY = 'accounts.claude-launch-account.v2' as const

export const ACCOUNT_RUNTIME_CAPABILITIES = [
  ACCOUNT_IMPORT_RUNTIME_CAPABILITY,
  CLAUDE_SIGN_IN_RUNTIME_CAPABILITY,
  CLAUDE_FOLDER_ACCOUNT_RUNTIME_CAPABILITY,
  CLAUDE_ACCOUNT_LABEL_RUNTIME_CAPABILITY,
  ANTIGRAVITY_ACCOUNTS_RUNTIME_CAPABILITY,
  ANTIGRAVITY_CHAT_SIGN_IN_RUNTIME_CAPABILITY,
  DATA_ACCOUNT_RUNTIME_CAPABILITY,
  CODEX_RESET_CREDIT_RUNTIME_CAPABILITY,
  CLAUDE_LAUNCH_ACCOUNT_RUNTIME_CAPABILITY
] as const
