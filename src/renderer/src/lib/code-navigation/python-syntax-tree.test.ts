import { describe, expect, it } from 'vitest'
import type { CodeOutlineSymbol, CodeRange } from './code-navigation-types'
import { getPythonSyntaxTree, parsePythonSyntaxTree, pythonScopeAt } from './python-syntax-tree'

const SAMPLE = `"""Module docstring."""
import os
from typing import (
    Any,
)

MAX_SIZE = 10
counter: int = 0
type Alias = list[int]


@dataclass
@other(
    arg=1,
)
class Config(Base):
    """Doc."""

    name: str
    DEFAULT = "x"

    def __init__(self, value):
        self.value = value  # not an outline entry

    @property
    def size(self) -> int:
        def helper():
            return 1

        return helper()

    async def fetch(self): ...

    class Inner:
        flag = True


def top_level(a, b):
    total = a + b
    for item in range(3):
        pass
    return total


def one_liner(): return 1
`

type OutlineSummary = { name: string; kind: string; children?: OutlineSummary[] }

function summarize(symbols: readonly CodeOutlineSymbol[]): OutlineSummary[] {
  return symbols.map((symbol) =>
    symbol.children.length > 0
      ? { name: symbol.name, kind: symbol.kind, children: summarize(symbol.children) }
      : { name: symbol.name, kind: symbol.kind }
  )
}

function lineOf(text: string, needle: string): number {
  const index = text.indexOf(needle)
  expect(index).toBeGreaterThanOrEqual(0)
  return text.slice(0, index).split('\n').length
}

function lineEndColumn(text: string, needle: string): number {
  const line = text.split('\n')[lineOf(text, needle) - 1]
  return line.trimEnd().length + 1
}

function before(a: CodeRange, b: CodeRange): boolean {
  return (
    a.startLineNumber < b.startLineNumber ||
    (a.startLineNumber === b.startLineNumber && a.startColumn <= b.startColumn)
  )
}

function ends(a: CodeRange, b: CodeRange): boolean {
  return (
    a.endLineNumber > b.endLineNumber ||
    (a.endLineNumber === b.endLineNumber && a.endColumn >= b.endColumn)
  )
}

function expectNested(symbols: readonly CodeOutlineSymbol[], parent?: CodeOutlineSymbol): void {
  for (const symbol of symbols) {
    expect(
      before(symbol.range, symbol.selectionRange) && ends(symbol.range, symbol.selectionRange)
    ).toBe(true)
    if (parent) {
      expect(before(parent.range, symbol.range) && ends(parent.range, symbol.range)).toBe(true)
    }
    expectNested(symbol.children, symbol)
  }
}

function find(symbols: readonly CodeOutlineSymbol[], path: string): CodeOutlineSymbol {
  const [head, ...rest] = path.split('/')
  const symbol = symbols.find((candidate) => candidate.name === head)
  if (!symbol) {
    throw new Error(`missing ${path}`)
  }
  return rest.length === 0 ? symbol : find(symbol.children, rest.join('/'))
}

describe('python outline', () => {
  const tree = parsePythonSyntaxTree(SAMPLE)

  it('lists classes, methods, nested functions and module/class variables with their kinds', () => {
    expect(summarize(tree.outline)).toEqual([
      { name: 'MAX_SIZE', kind: 'constant' },
      { name: 'counter', kind: 'variable' },
      { name: 'Alias', kind: 'type' },
      {
        name: 'Config',
        kind: 'class',
        children: [
          { name: 'name', kind: 'variable' },
          { name: 'DEFAULT', kind: 'constant' },
          { name: '__init__', kind: 'constructor' },
          { name: 'size', kind: 'method', children: [{ name: 'helper', kind: 'function' }] },
          { name: 'fetch', kind: 'method' },
          { name: 'Inner', kind: 'class', children: [{ name: 'flag', kind: 'variable' }] }
        ]
      },
      { name: 'top_level', kind: 'function' },
      { name: 'one_liner', kind: 'function' }
    ])
  })

  it('spans decorators through the last non-blank line of the block', () => {
    const config = find(tree.outline, 'Config')
    expect(config.range).toEqual({
      startLineNumber: lineOf(SAMPLE, '@dataclass'),
      startColumn: 1,
      endLineNumber: lineOf(SAMPLE, 'flag = True'),
      endColumn: lineEndColumn(SAMPLE, 'flag = True')
    })
    expect(config.selectionRange).toEqual({
      startLineNumber: lineOf(SAMPLE, 'class Config'),
      startColumn: 7,
      endLineNumber: lineOf(SAMPLE, 'class Config'),
      endColumn: 13
    })
    const size = find(tree.outline, 'Config/size')
    expect(size.range.startLineNumber).toBe(lineOf(SAMPLE, '@property'))
    expect(size.range.startColumn).toBe(5)
    expect(size.range.endLineNumber).toBe(lineOf(SAMPLE, 'return helper()'))
    const init = find(tree.outline, 'Config/__init__')
    expect(init.range.endLineNumber).toBe(lineOf(SAMPLE, 'self.value = value'))
    expect(init.range.endColumn).toBe(lineEndColumn(SAMPLE, 'self.value = value'))
    const oneLiner = find(tree.outline, 'one_liner')
    expect(oneLiner.range.startLineNumber).toBe(oneLiner.range.endLineNumber)
  })

  it('keeps every selectionRange inside its range and children inside parents', () => {
    expectNested(tree.outline)
  })

  it('gives stable path ids that disambiguate same-named siblings', () => {
    const source =
      'class A:\n    @property\n    def x(self): ...\n    @x.setter\n    def x(self, v): ...\n'
    const outline = parsePythonSyntaxTree(source).outline
    expect(outline[0].id).toBe('A#0')
    expect(outline[0].children.map((child) => child.id)).toEqual(['A#0/x#0', 'A#0/x#1'])
    expect(find(tree.outline, 'Config/size/helper').id).toBe('Config#0/size#0/helper#0')
  })

  it('lists a variable once per level and skips imports, loop targets and locals', () => {
    const source =
      'import os\nx = 1\nx = 2\nfor i in range(3):\n    y = i\nwith open(p) as f:\n    data = f.read()\n'
    expect(summarize(parsePythonSyntaxTree(source).outline)).toEqual([
      { name: 'x', kind: 'variable' },
      { name: 'y', kind: 'variable' },
      { name: 'data', kind: 'variable' }
    ])
  })

  it('reads tab-indented bodies and one-line classes', () => {
    const source =
      'class T:\n\tdef a(self):\n\t\treturn 1\n\tdef b(self):\n\t\tpass\nclass One: value = 1\n'
    expect(summarize(parsePythonSyntaxTree(source).outline)).toEqual([
      {
        name: 'T',
        kind: 'class',
        children: [
          { name: 'a', kind: 'method' },
          { name: 'b', kind: 'method' }
        ]
      },
      { name: 'One', kind: 'class', children: [{ name: 'value', kind: 'variable' }] }
    ])
  })

  it('places defs nested in module-level if/try blocks at module level', () => {
    const source =
      'try:\n    import ujson as json\nexcept ImportError:\n    def loads(s):\n        return s\n'
    expect(summarize(parsePythonSyntaxTree(source).outline)).toEqual([
      { name: 'loads', kind: 'function' }
    ])
  })

  it('still outlines definitions after an unclosed bracket', () => {
    const source = 'value = call(\n\ndef after():\n    pass\n'
    expect(summarize(parsePythonSyntaxTree(source).outline)).toEqual([
      { name: 'value', kind: 'variable' },
      { name: 'after', kind: 'function' }
    ])
  })
})

describe('python scopes', () => {
  const tree = parsePythonSyntaxTree(SAMPLE)

  it('nests module, class and function scopes', () => {
    const config = tree.module.children.find((scope) => scope.definition?.name === 'Config')
    expect(config?.kind).toBe('class')
    expect(config?.bases).toEqual([{ parts: ['Base'], offset: SAMPLE.indexOf('Base)') }])
    const init = config?.children.find((scope) => scope.definition?.name === '__init__')
    expect(init?.parameters.map((p) => p.name)).toEqual(['self', 'value'])
    expect(init?.attributes.map((a) => `${a.receiver}.${a.binding.name}`)).toEqual(['self.value'])
  })

  it('finds the innermost scope at an offset', () => {
    expect(pythonScopeAt(tree, SAMPLE.indexOf('return 1')).definition?.name).toBe('helper')
    expect(pythonScopeAt(tree, SAMPLE.indexOf('DEFAULT')).definition?.name).toBe('Config')
    expect(pythonScopeAt(tree, SAMPLE.indexOf('class Config')).kind).toBe('module')
    expect(pythonScopeAt(tree, SAMPLE.indexOf('total = a')).definition?.name).toBe('top_level')
    expect(pythonScopeAt(tree, SAMPLE.indexOf('return 1\n') + 20).kind).toBe('function')
  })

  it('collects module references and star imports', () => {
    const star = parsePythonSyntaxTree('from .a import *\nfrom b import c\n')
    expect(star.starImports).toEqual([{ level: 1, module: 'a' }])
    expect(star.moduleReferences).toHaveLength(2)
  })
})

describe('getPythonSyntaxTree', () => {
  it('reuses a parse for the same key and text and reparses on change', () => {
    const first = getPythonSyntaxTree('x = 1\n', 'test:cache-a')
    expect(getPythonSyntaxTree('x = 1\n', 'test:cache-a')).toBe(first)
    const changed = getPythonSyntaxTree('x = 2\n', 'test:cache-a')
    expect(changed).not.toBe(first)
    expect(getPythonSyntaxTree('x = 2\n', 'test:cache-b')).not.toBe(changed)
  })

  it('evicts the least recently used entry past its bound', () => {
    const kept = getPythonSyntaxTree('kept = 1\n', 'test:lru-0')
    for (let i = 1; i <= 40; i++) {
      getPythonSyntaxTree(`v${i} = 1\n`, `test:lru-${i}`)
    }
    expect(getPythonSyntaxTree('kept = 1\n', 'test:lru-0')).not.toBe(kept)
  })
})
