import { describe, expect, it } from 'vitest'
import type { CodeOutlineSymbol, CodeSymbolKind } from '@/lib/code-navigation/code-navigation-types'
import {
  codeOutlinePathsEqual,
  filterCodeOutline,
  findCodeOutlineSymbolPath,
  findFirstCodeOutlineMatch,
  findVisibleCodeOutlineId
} from './code-outline-tree'

function symbol(
  id: string,
  kind: CodeSymbolKind,
  lines: [number, number],
  children: CodeOutlineSymbol[] = []
): CodeOutlineSymbol {
  return {
    id,
    name: id,
    kind,
    range: { startLineNumber: lines[0], startColumn: 1, endLineNumber: lines[1], endColumn: 2 },
    selectionRange: {
      startLineNumber: lines[0],
      startColumn: 7,
      endLineNumber: lines[0],
      endColumn: 7 + id.length
    },
    children
  }
}

const outline: CodeOutlineSymbol[] = [
  symbol(
    'Parser',
    'class',
    [1, 20],
    [
      symbol('constructor', 'constructor', [2, 4]),
      symbol('parseValue', 'method', [6, 12], [symbol('cursor', 'variable', [7, 7])]),
      symbol('reset', 'method', [14, 19])
    ]
  ),
  symbol('createParser', 'function', [22, 25])
]

describe('filterCodeOutline', () => {
  it('returns the same tree for a blank query', () => {
    expect(filterCodeOutline(outline, '   ')).toBe(outline)
  })

  it('keeps case-insensitive matches with their ancestors and drops the rest', () => {
    const filtered = filterCodeOutline(outline, 'CURSOR')
    expect(filtered.map((node) => node.id)).toEqual(['Parser'])
    expect(filtered[0].children.map((node) => node.id)).toEqual(['parseValue'])
    expect(filtered[0].children[0].children.map((node) => node.id)).toEqual(['cursor'])
  })

  it('keeps a matching parent while hiding its non-matching children', () => {
    const filtered = filterCodeOutline(outline, 'parse')
    expect(filtered.map((node) => node.id)).toEqual(['Parser', 'createParser'])
    expect(filtered[0].children.map((node) => node.id)).toEqual(['parseValue'])
    expect(filtered[0].children[0].children).toEqual([])
  })

  it('returns nothing when no name matches', () => {
    expect(filterCodeOutline(outline, 'zzz')).toEqual([])
  })
})

describe('findFirstCodeOutlineMatch', () => {
  it('returns the first match in document order, parents before children', () => {
    expect(findFirstCodeOutlineMatch(outline, 'PARSE')?.id).toBe('Parser')
    expect(findFirstCodeOutlineMatch(outline, 'cur')?.id).toBe('cursor')
    expect(findFirstCodeOutlineMatch(outline, 'nothing')).toBeNull()
    expect(findFirstCodeOutlineMatch(outline, ' ')).toBeNull()
  })
})

describe('findCodeOutlineSymbolPath', () => {
  it('returns the ancestor path down to the deepest containing symbol', () => {
    expect(findCodeOutlineSymbolPath(outline, { lineNumber: 7, column: 2 })).toEqual([
      'Parser',
      'parseValue',
      'cursor'
    ])
    expect(findCodeOutlineSymbolPath(outline, { lineNumber: 15, column: 1 })).toEqual([
      'Parser',
      'reset'
    ])
  })

  it('treats the range end as inside and the gap between symbols as outside', () => {
    expect(findCodeOutlineSymbolPath(outline, { lineNumber: 25, column: 2 })).toEqual([
      'createParser'
    ])
    expect(findCodeOutlineSymbolPath(outline, { lineNumber: 25, column: 3 })).toEqual([])
    expect(findCodeOutlineSymbolPath(outline, { lineNumber: 21, column: 1 })).toEqual([])
    expect(findCodeOutlineSymbolPath(outline, { lineNumber: 5, column: 1 })).toEqual(['Parser'])
  })

  it('returns an empty path without a position', () => {
    expect(findCodeOutlineSymbolPath(outline, null)).toEqual([])
  })
})

describe('findVisibleCodeOutlineId', () => {
  const path = ['Parser', 'parseValue', 'cursor']

  it('returns the deepest symbol when nothing is collapsed', () => {
    expect(findVisibleCodeOutlineId(outline, path, new Set())).toBe('cursor')
  })

  it('falls back to the collapsed ancestor that hides the current symbol', () => {
    expect(findVisibleCodeOutlineId(outline, path, new Set(['Parser']))).toBe('Parser')
    expect(findVisibleCodeOutlineId(outline, path, new Set(['parseValue']))).toBe('parseValue')
  })

  it('falls back to the deepest ancestor a filter kept', () => {
    const filtered = filterCodeOutline(outline, 'parseValue')
    expect(findVisibleCodeOutlineId(filtered, path, new Set())).toBe('parseValue')
    expect(findVisibleCodeOutlineId(filterCodeOutline(outline, 'create'), path, new Set())).toBe(
      null
    )
  })
})

describe('codeOutlinePathsEqual', () => {
  it('compares paths by value', () => {
    expect(codeOutlinePathsEqual(['a', 'b'], ['a', 'b'])).toBe(true)
    expect(codeOutlinePathsEqual(['a'], ['a', 'b'])).toBe(false)
    expect(codeOutlinePathsEqual(['a', 'c'], ['a', 'b'])).toBe(false)
  })
})
