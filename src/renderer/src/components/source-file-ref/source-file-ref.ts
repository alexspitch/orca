// A source file a plan names in inline code: `exec_input_node.py:160-257`, `src/app.ts:12`.

export type SourceFileRef = { path: string; line?: number; endLine?: number }

const REF =
  /^((?:[\w.@+-]+\/)*[\w@+-][\w.@+-]*\.[A-Za-z][A-Za-z0-9]{0,9})(?::(\d+)(?:-(\d+))?(?::\d+)?)?$/

export function parseSourceFileRef(text: string): SourceFileRef | null {
  const match = REF.exec(text.trim().replace(/^\.\//, ''))
  if (!match) {
    return null
  }
  const [, path, line, endLine] = match
  // Why: a bare `name.ext` with no line is as often an identifier (`os.path`) as a file.
  if (!line && !path.includes('/')) {
    return null
  }
  const first = line ? Number(line) : undefined
  if (first !== undefined && (!Number.isSafeInteger(first) || first < 1)) {
    return null
  }
  return {
    path,
    ...(first !== undefined ? { line: first } : {}),
    ...(endLine ? { endLine: Number(endLine) } : {})
  }
}

/** A worktree-relative path the reference can mean: the same path, or one ending in it. */
export function matchesSourceFileRef(candidate: string, refPath: string): boolean {
  const normalized = candidate.replace(/\\/g, '/')
  return normalized === refPath || normalized.endsWith(`/${refPath}`)
}

/** Shortest first: the file nearest the root is the likeliest meant. */
export function sourceFileRefMatches(candidates: readonly string[], refPath: string): string[] {
  const unique = [...new Set(candidates.map((c) => c.replace(/\\/g, '/')))]
  return unique
    .filter((c) => matchesSourceFileRef(c, refPath))
    .sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b))
}

/** A markdown `code` element's reference: inline code only, so a fenced block stays code. */
export function sourceFileRefOfCode(
  className: string | undefined,
  children: unknown
): { text: string; ref: SourceFileRef } | null {
  const text = Array.isArray(children) && children.length === 1 ? children[0] : children
  if (className || typeof text !== 'string' || text.includes('\n')) {
    return null
  }
  const ref = parseSourceFileRef(text)
  return ref ? { text, ref } : null
}
