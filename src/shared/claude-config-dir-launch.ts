// Why: a folder the user picked (their own CLAUDE_CONFIG_DIR) has none of Orca's hooks or usage
// status line, so the pane's `claude` function asks Orca to merge them in before Claude reads it.
export const CLAUDE_CONFIG_DIR_LAUNCH_PATHNAME = '/claude/config-dir'

/**
 * POSIX sh, run as `/bin/sh -c '<this>'` from every shell's `claude` function, so it holds no single
 * quote. The endpoint file refreshes port/token for a PTY that outlived an Orca restart.
 */
export const CLAUDE_CONFIG_DIR_LAUNCH_SH = [
  '[ -n "${ORCA_AGENT_HOOK_ENDPOINT:-}" ] && [ -r "$ORCA_AGENT_HOOK_ENDPOINT" ] && . "$ORCA_AGENT_HOOK_ENDPOINT";',
  '[ -n "${ORCA_AGENT_HOOK_PORT:-}" ] && [ -n "${ORCA_AGENT_HOOK_TOKEN:-}" ] && [ -n "${CLAUDE_CONFIG_DIR:-}" ] &&',
  `curl -sS -X POST "http://127.0.0.1:\${ORCA_AGENT_HOOK_PORT}${CLAUDE_CONFIG_DIR_LAUNCH_PATHNAME}"`,
  '--connect-timeout 0.5 --max-time 5 -H "Content-Type: application/x-www-form-urlencoded"',
  '-H "X-Orca-Agent-Hook-Token: ${ORCA_AGENT_HOOK_TOKEN}" --data-urlencode "configDir=${CLAUDE_CONFIG_DIR}"'
].join(' ')

export function parseClaudeConfigDirLaunchBody(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('configDir' in body)) {
    return null
  }
  // Why untrimmed: the spelling is the folder Claude runs in.
  return typeof body.configDir === 'string' && body.configDir.trim() ? body.configDir : null
}
