import type { CodeOutlineSymbol, CodeSymbolKind } from './code-navigation-types'
import { offsetRangeToCodeRange, type LineStarts } from './source-text-positions'

/** The slice of Monaco's TypeScript worker the engine uses; its payloads are untyped. */
export type TsWorkerLike = {
  getNavigationTree(fileName: string): Promise<unknown>
  getDefinitionAtPosition(fileName: string, position: number): Promise<unknown>
}

export type TsTextSpan = { start: number; length: number }
export type TsDefinitionInfo = { fileName: string; textSpan: TsTextSpan }

type TsNavigationItem = {
  text: string
  kind: string
  spans: TsTextSpan[]
  nameSpan?: TsTextSpan
  childItems: TsNavigationItem[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toTextSpan(value: unknown): TsTextSpan | null {
  if (!isRecord(value) || typeof value.start !== 'number' || typeof value.length !== 'number') {
    return null
  }
  return { start: value.start, length: value.length }
}

export function toDefinitionInfos(value: unknown): TsDefinitionInfo[] {
  if (!Array.isArray(value)) {
    return []
  }
  const infos: TsDefinitionInfo[] = []
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.fileName !== 'string') {
      continue
    }
    const textSpan = toTextSpan(entry.textSpan)
    if (textSpan) {
      infos.push({ fileName: entry.fileName, textSpan })
    }
  }
  return infos
}

function toNavigationItem(value: unknown, depth: number): TsNavigationItem | null {
  if (!isRecord(value) || typeof value.text !== 'string' || typeof value.kind !== 'string') {
    return null
  }
  const spans = Array.isArray(value.spans)
    ? value.spans.map(toTextSpan).filter((span) => span !== null)
    : []
  if (spans.length === 0) {
    return null
  }
  const children =
    depth < 32 && Array.isArray(value.childItems)
      ? value.childItems
          .map((child) => toNavigationItem(child, depth + 1))
          .filter((child) => child !== null)
      : []
  return {
    text: value.text,
    kind: value.kind,
    spans,
    nameSpan: toTextSpan(value.nameSpan) ?? undefined,
    childItems: children
  }
}

// Why a Map: a plain object would answer prototype keys like 'constructor' for unknown kinds.
const TS_KIND_TO_SYMBOL_KIND: ReadonlyMap<string, CodeSymbolKind> = new Map<string, CodeSymbolKind>(
  [
    ['module', 'namespace'],
    ['class', 'class'],
    ['local class', 'class'],
    ['interface', 'interface'],
    ['type', 'type'],
    ['enum', 'enum'],
    ['enum member', 'enumMember'],
    ['function', 'function'],
    ['local function', 'function'],
    ['method', 'method'],
    ['constructor', 'constructor'],
    ['getter', 'property'],
    ['setter', 'property'],
    ['property', 'property'],
    ['var', 'variable'],
    ['let', 'variable'],
    ['local var', 'variable'],
    ['const', 'variable']
  ]
)

function symbolKindFor(item: TsNavigationItem): CodeSymbolKind | null {
  const kind = TS_KIND_TO_SYMBOL_KIND.get(item.kind)
  if (kind === 'variable' && item.kind === 'const' && /^[A-Z][A-Z0-9_]*$/.test(item.text)) {
    return 'constant'
  }
  return kind ?? null
}

function toOutlineSymbols(
  items: readonly TsNavigationItem[],
  lineStarts: LineStarts,
  parentId: string
): CodeOutlineSymbol[] {
  const symbols: CodeOutlineSymbol[] = []
  const seen = new Map<string, number>()
  for (const item of items) {
    const kind = symbolKindFor(item)
    // Imports ('alias') and signatures are noise in an outline.
    if (!kind) {
      continue
    }
    const start = Math.min(...item.spans.map((span) => span.start))
    const end = Math.max(...item.spans.map((span) => span.start + span.length))
    const name = item.nameSpan ?? { start, length: Math.min(item.text.length, end - start) }
    const nameStart = Math.min(Math.max(name.start, start), end)
    const nameEnd = Math.min(nameStart + name.length, end)
    const occurrence = seen.get(item.text) ?? 0
    seen.set(item.text, occurrence + 1)
    const id = `${parentId}/${item.text}#${occurrence}`
    symbols.push({
      id,
      name: item.text,
      kind,
      range: offsetRangeToCodeRange(lineStarts, start, end),
      selectionRange: offsetRangeToCodeRange(lineStarts, nameStart, nameEnd),
      children: toOutlineSymbols(item.childItems, lineStarts, id)
    })
  }
  // Why: the navigation tree is sorted by name; an outline reads in source order.
  return symbols.sort(
    (a, b) =>
      a.range.startLineNumber - b.range.startLineNumber || a.range.startColumn - b.range.startColumn
  )
}

/** Outline from a `getNavigationTree` payload; the root item is the file itself. */
export function navigationTreeToOutline(
  tree: unknown,
  lineStarts: LineStarts
): CodeOutlineSymbol[] {
  const root = toNavigationItem(tree, 0)
  return root ? toOutlineSymbols(root.childItems, lineStarts, '') : []
}

/** TS standard-library files the worker serves itself, e.g. `lib.dom.d.ts`. */
export function isTsLibFileName(fileName: string): boolean {
  return /^(file:\/\/\/)?lib\.[^/]*\.d\.ts$/.test(fileName)
}
