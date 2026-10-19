import { describe, expect, it } from 'vitest'
import { computeLineStarts } from './source-text-positions'
import { isTsLibFileName, navigationTreeToOutline, toDefinitionInfos } from './ts-worker-client'

const text = [
  "import { x } from './x'",
  'export class Store {',
  '  load() {}',
  '}',
  'const MAX_SIZE = 3',
  'function run() {}'
].join('\n')
const lineStarts = computeLineStarts(text)
const offsetOf = (needle: string): number => text.indexOf(needle)
const span = (needle: string) => ({ start: offsetOf(needle), length: needle.length })

describe('navigationTreeToOutline', () => {
  it('maps kinds, ranges and name spans, dropping imports', () => {
    const classText = text.slice(offsetOf('export class'), offsetOf('}\nconst') + 1)
    const tree = {
      text: '"file"',
      kind: 'module',
      spans: [{ start: 0, length: text.length }],
      childItems: [
        { text: 'x', kind: 'alias', spans: [span('x')], childItems: [] },
        {
          text: 'Store',
          kind: 'class',
          spans: [span(classText)],
          nameSpan: span('Store'),
          childItems: [
            { text: 'load', kind: 'method', spans: [span('load() {}')], nameSpan: span('load') }
          ]
        },
        {
          text: 'MAX_SIZE',
          kind: 'const',
          spans: [span('MAX_SIZE = 3')],
          nameSpan: span('MAX_SIZE')
        },
        { text: 'run', kind: 'function', spans: [span('function run() {}')], nameSpan: span('run') }
      ]
    }
    const outline = navigationTreeToOutline(tree, lineStarts)
    expect(outline.map((symbol) => [symbol.name, symbol.kind])).toEqual([
      ['Store', 'class'],
      ['MAX_SIZE', 'constant'],
      ['run', 'function']
    ])
    const store = outline[0]
    expect(store.range).toEqual({
      startLineNumber: 2,
      startColumn: 1,
      endLineNumber: 4,
      endColumn: 2
    })
    expect(store.selectionRange).toEqual({
      startLineNumber: 2,
      startColumn: 14,
      endLineNumber: 2,
      endColumn: 19
    })
    expect(store.children.map((child) => [child.name, child.kind])).toEqual([['load', 'method']])
    expect(new Set([store.id, store.children[0].id, outline[1].id]).size).toBe(3)
  })

  it("orders symbols by position, not by the tree's name order", () => {
    const tree = {
      text: 'file',
      kind: 'module',
      spans: [{ start: 0, length: text.length }],
      childItems: [
        { text: 'run', kind: 'function', spans: [span('function run() {}')] },
        { text: 'MAX_SIZE', kind: 'const', spans: [span('MAX_SIZE = 3')] }
      ]
    }
    expect(navigationTreeToOutline(tree, lineStarts).map((symbol) => symbol.name)).toEqual([
      'MAX_SIZE',
      'run'
    ])
  })

  it('ignores malformed payloads', () => {
    expect(navigationTreeToOutline(undefined, lineStarts)).toEqual([])
    expect(navigationTreeToOutline({ text: 'x', kind: 'module', spans: [] }, lineStarts)).toEqual(
      []
    )
    expect(
      navigationTreeToOutline(
        {
          text: 'f',
          kind: 'module',
          spans: [{ start: 0, length: 1 }],
          childItems: [{ kind: 'class' }]
        },
        lineStarts
      )
    ).toEqual([])
  })
})

describe('toDefinitionInfos', () => {
  it('keeps only well-formed entries', () => {
    expect(
      toDefinitionInfos([
        { fileName: 'file:///a.ts', textSpan: { start: 1, length: 2 } },
        { fileName: 'file:///b.ts' },
        null,
        'x'
      ])
    ).toEqual([{ fileName: 'file:///a.ts', textSpan: { start: 1, length: 2 } }])
    expect(toDefinitionInfos(undefined)).toEqual([])
  })
})

describe('isTsLibFileName', () => {
  it('recognizes only the worker-served standard libraries', () => {
    expect(isTsLibFileName('lib.dom.d.ts')).toBe(true)
    expect(isTsLibFileName('file:///lib.es2015.promise.d.ts')).toBe(true)
    expect(isTsLibFileName('file:///repo/src/lib.custom.d.ts')).toBe(false)
  })
})
