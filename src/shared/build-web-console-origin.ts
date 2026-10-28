// IS-147: whether two console URLs name one console. A task worktree, a queued report and a
// client's connection may spell it differently (case, trailing slash, a default port).

function consoleOrigin(url: string): string {
  const trimmed = url.trim()
  try {
    const origin = new URL(trimmed).origin
    // Why: every URL without a web origin answers 'null', which would make them all equal.
    if (origin !== 'null') {
      return origin
    }
  } catch {
    // Not a URL: compared as typed, minus case and trailing slashes.
  }
  return trimmed.replace(/\/+$/, '').toLowerCase()
}

export function sameBuildWebConsole(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  return Boolean(left && right) && consoleOrigin(left ?? '') === consoleOrigin(right ?? '')
}
