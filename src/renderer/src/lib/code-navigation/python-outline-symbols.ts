import type { CodeOutlineSymbol, CodeSymbolKind } from './code-navigation-types'
import type { PythonBinding } from './python-binding-types'
import type { PythonLogicalLine, PythonSourceScan } from './python-logical-lines'
import { offsetRangeToCodeRange, offsetToPosition } from './source-text-positions'

/** One outline level: its symbols plus what keeps sibling ids unique and variables listed once. */
export type PythonOutlineContainer = {
  symbols: CodeOutlineSymbol[]
  idPrefix: string
  siblingCounts: Map<string, number>
  variableNames: Set<string>
}

const CONSTANT_NAME = /^_*[A-Z][A-Z0-9_]*$/

export function createOutlineContainer(
  symbols: CodeOutlineSymbol[],
  idPrefix: string
): PythonOutlineContainer {
  return { symbols, idPrefix, siblingCounts: new Map(), variableNames: new Set() }
}

/** 1-based column just past the last non-whitespace character of a physical line. */
export function pythonLineEndColumn(scan: PythonSourceScan, physicalLine: number): number {
  const { text, lineStarts } = scan
  const start = lineStarts[physicalLine]
  const next = physicalLine + 1 < lineStarts.length ? lineStarts[physicalLine + 1] : text.length
  return text.slice(start, next).trimEnd().length + 1
}

/** Appends a symbol spanning `rangeStart` to the end of `endLine`, selecting the binding's name. */
export function pushOutlineSymbol(
  scan: PythonSourceScan,
  container: PythonOutlineContainer,
  binding: PythonBinding,
  kind: CodeSymbolKind,
  rangeStart: number,
  endLine: number
): CodeOutlineSymbol {
  const count = container.siblingCounts.get(binding.name) ?? 0
  container.siblingCounts.set(binding.name, count + 1)
  const start = offsetToPosition(scan.lineStarts, rangeStart)
  const symbol: CodeOutlineSymbol = {
    id: `${container.idPrefix}${binding.name}#${count}`,
    name: binding.name,
    kind,
    range: {
      startLineNumber: start.lineNumber,
      startColumn: start.column,
      endLineNumber: endLine + 1,
      endColumn: pythonLineEndColumn(scan, endLine)
    },
    selectionRange: offsetRangeToCodeRange(
      scan.lineStarts,
      binding.offset,
      binding.offset + binding.name.length
    ),
    children: []
  }
  container.symbols.push(symbol)
  return symbol
}

export function definitionSymbolKind(
  binding: PythonBinding,
  parentKind: 'module' | 'class' | 'function'
): CodeSymbolKind {
  if (binding.kind === 'class') {
    return 'class'
  }
  if (parentKind !== 'class') {
    return 'function'
  }
  return binding.name === '__init__' ? 'constructor' : 'method'
}

/** Module- and class-level assignments and type aliases, each name listed once per level. */
export function addVariableOutlineSymbols(
  scan: PythonSourceScan,
  container: PythonOutlineContainer,
  bindings: readonly PythonBinding[],
  line: PythonLogicalLine
): void {
  for (const binding of bindings) {
    if (binding.kind !== 'assignment' && binding.kind !== 'typeAlias') {
      continue
    }
    if (container.variableNames.has(binding.name)) {
      continue
    }
    container.variableNames.add(binding.name)
    let kind: CodeSymbolKind = 'variable'
    if (binding.kind === 'typeAlias') {
      kind = 'type'
    } else if (CONSTANT_NAME.test(binding.name)) {
      kind = 'constant'
    }
    pushOutlineSymbol(scan, container, binding, kind, line.start, line.endLine)
  }
}
