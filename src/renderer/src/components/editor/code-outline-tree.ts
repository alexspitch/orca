import type {
  CodeOutlineSymbol,
  CodePosition,
  CodeRange
} from '@/lib/code-navigation/code-navigation-types'

/** Symbols whose name contains `query` (case-insensitive), plus their ancestors; the input when blank. */
export function filterCodeOutline(
  symbols: readonly CodeOutlineSymbol[],
  query: string
): readonly CodeOutlineSymbol[] {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return symbols
  }
  const visit = (nodes: readonly CodeOutlineSymbol[]): CodeOutlineSymbol[] => {
    const kept: CodeOutlineSymbol[] = []
    for (const node of nodes) {
      const children = visit(node.children)
      if (children.length > 0 || node.name.toLowerCase().includes(needle)) {
        kept.push({ ...node, children })
      }
    }
    return kept
  }
  return visit(symbols)
}

/** The first symbol, in document order, whose name contains `query`; null when blank. */
export function findFirstCodeOutlineMatch(
  symbols: readonly CodeOutlineSymbol[],
  query: string
): CodeOutlineSymbol | null {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return null
  }
  for (const node of symbols) {
    if (node.name.toLowerCase().includes(needle)) {
      return node
    }
    const nested = findFirstCodeOutlineMatch(node.children, needle)
    if (nested) {
      return nested
    }
  }
  return null
}

function compareToRangeStart(position: CodePosition, range: CodeRange): number {
  return position.lineNumber - range.startLineNumber || position.column - range.startColumn
}

function compareToRangeEnd(position: CodePosition, range: CodeRange): number {
  return position.lineNumber - range.endLineNumber || position.column - range.endColumn
}

// Why end-inclusive: a caret right after a declaration's closing brace still reads as inside it.
function rangeContains(range: CodeRange, position: CodePosition): boolean {
  return compareToRangeStart(position, range) >= 0 && compareToRangeEnd(position, range) <= 0
}

/** Ids from the outermost to the deepest symbol whose range contains `position`. */
export function findCodeOutlineSymbolPath(
  symbols: readonly CodeOutlineSymbol[],
  position: CodePosition | null
): string[] {
  const path: string[] = []
  if (!position) {
    return path
  }
  let level: readonly CodeOutlineSymbol[] = symbols
  for (;;) {
    const match = level.find((symbol) => rangeContains(symbol.range, position))
    if (!match) {
      return path
    }
    path.push(match.id)
    level = match.children
  }
}

/** The deepest id on `path` the list actually shows: collapsed or filtered-out descendants fall back to their ancestor. */
export function findVisibleCodeOutlineId(
  symbols: readonly CodeOutlineSymbol[],
  path: readonly string[],
  collapsedIds: ReadonlySet<string>
): string | null {
  let visible: string | null = null
  let level: readonly CodeOutlineSymbol[] = symbols
  for (const id of path) {
    const node = level.find((symbol) => symbol.id === id)
    if (!node) {
      return visible
    }
    visible = node.id
    if (collapsedIds.has(node.id)) {
      return visible
    }
    level = node.children
  }
  return visible
}

export function codeOutlinePathsEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index])
}
