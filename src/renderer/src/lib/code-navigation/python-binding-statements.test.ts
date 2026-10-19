import { describe, expect, it } from 'vitest'
import type { PythonBinding } from './python-binding-types'
import { parsePythonLine } from './python-binding-statements'
import { parsePythonExpressionLocals } from './python-clause-targets'
import { scanPythonSource } from './python-logical-lines'

function parse(source: string, lineIndex = 0): ReturnType<typeof parsePythonLine> {
  const scan = scanPythonSource(source)
  const line = scan.lines[lineIndex]
  return parsePythonLine(scan.code, line.start, line.end, lineIndex)
}

function summary(bindings: readonly PythonBinding[]): string[] {
  return bindings.map((binding) => `${binding.kind}:${binding.name}`)
}

function expectOffsetsMatch(source: string, bindings: readonly PythonBinding[]): void {
  for (const binding of bindings) {
    expect(source.slice(binding.offset, binding.offset + binding.name.length)).toBe(binding.name)
  }
}

describe('parsePythonLine: definitions', () => {
  it('reads a def name and every parameter form', () => {
    const source = 'def f(a, b: int = 1, /, *args, c, d=(1, 2), **kw) -> dict[str, int]:\n'
    const parsed = parse(source)
    expect(summary(parsed.facts.bindings)).toEqual(['def:f'])
    expect(summary(parsed.definition?.parameters ?? [])).toEqual(
      ['a', 'b', 'args', 'c', 'd', 'kw'].map((name) => `parameter:${name}`)
    )
    expect(parsed.opensBlock).toBe(true)
    expect(parsed.definition?.bodyOffset).toBe(source.indexOf(':\n') + 1)
    expectOffsetsMatch(source, parsed.definition?.parameters ?? [])
  })

  it('handles bare `*`, async def, type parameters and lambda defaults', () => {
    const parsed = parse('async def g[T](self, *, key=lambda k: k, item: T) -> T:\n')
    expect(parsed.definition?.binding.name).toBe('g')
    expect(parsed.definition?.parameters.map((binding) => binding.name)).toEqual([
      'T',
      'self',
      'key',
      'item'
    ])
    expect(parsed.opensBlock).toBe(true)
  })

  it('parses a one-line def body into its own facts', () => {
    const parsed = parse('def h(x): y = x; return y\n')
    expect(parsed.opensBlock).toBe(false)
    expect(summary(parsed.facts.bindings)).toEqual(['def:h'])
    expect(summary(parsed.definition?.inlineBody?.bindings ?? [])).toEqual(['assignment:y'])
  })

  it('reads dotted and subscripted bases, skipping keywords and star arguments', () => {
    const parsed = parse('class A(Base, pkg.mod.Mixin, Generic[T], *extra, metaclass=Meta):\n')
    expect(parsed.definition?.kind).toBe('class')
    expect(parsed.definition?.bases.map((base) => base.parts.join('.'))).toEqual([
      'Base',
      'pkg.mod.Mixin',
      'Generic'
    ])
  })

  it('treats a decorator line as a decorator', () => {
    expect(parse('@app.route("/x", methods=["GET"])\n').isDecorator).toBe(true)
  })

  it('keeps a def without a colon from opening a block', () => {
    const parsed = parse('def typing(a, b\n')
    expect(parsed.definition?.binding.name).toBe('typing')
    expect(parsed.opensBlock).toBe(false)
  })
})

describe('parsePythonLine: assignments', () => {
  it.each([
    ['x = 1', ['assignment:x']],
    ['x: int = 1', ['assignment:x']],
    ['x: int', ['assignment:x']],
    ['x += 1', ['augmented:x']],
    ['x //= 2', ['augmented:x']],
    ['a, (b, c) = 1, (2, 3)', ['assignment:a', 'assignment:b', 'assignment:c']],
    ['[d, *e] = values', ['assignment:d', 'assignment:e']],
    ['a = b = compute()', ['assignment:a', 'assignment:b']],
    ['obj[0] = 1', []],
    ['f(a=1)', []],
    ['x == 1', []],
    ['f = lambda a=1, b=2: a', ['assignment:f']],
    ['print("x = 1")', []],
    ['a = 1; b: str = ""', ['assignment:a', 'assignment:b']],
    ['type = 1', ['assignment:type']],
    ['type(x)', []],
    ['match = re.match(p, s)', ['assignment:match']],
    ['if (n := len(items)) > 3: total = n', ['target:n', 'assignment:total']],
    ['print(y := 5)', ['target:y']]
  ])('%s', (source, expected) => {
    const parsed = parse(`${source}\n`)
    expect(summary(parsed.facts.bindings)).toEqual(expected)
    expectOffsetsMatch(source, parsed.facts.bindings)
  })

  it('records `self.x` / `cls.x` assignments as attributes, not bindings', () => {
    const parsed = parse('self.x, cls.y = 1, 2\n')
    expect(parsed.facts.bindings).toEqual([])
    expect(parsed.facts.attributes.map((a) => `${a.receiver}.${a.binding.name}`)).toEqual([
      'self.x',
      'cls.y'
    ])
    const annotated = parse('self.count: int = 0\n')
    expect(annotated.facts.attributes.map((a) => a.binding.name)).toEqual(['count'])
  })

  it('reads 3.12 type aliases', () => {
    expect(summary(parse('type Vector = list[float]\n').facts.bindings)).toEqual([
      'typeAlias:Vector'
    ])
    expect(summary(parse('type Pair[T] = tuple[T, T]\n').facts.bindings)).toEqual([
      'typeAlias:Pair'
    ])
  })

  it('collects global and nonlocal declarations', () => {
    expect(parse('global a, b\n').facts.globals).toEqual(['a', 'b'])
    expect(parse('nonlocal c\n').facts.nonlocals).toEqual(['c'])
  })
})

describe('parsePythonLine: compound headers', () => {
  it.each([
    ['for i, (j, k) in items:', ['target:i', 'target:j', 'target:k']],
    ['async for chunk in stream:', ['target:chunk']],
    ['with open(p) as f, lock as (a, b):', ['target:f', 'target:a', 'target:b']],
    ['async with session() as s:', ['target:s']],
    ['with (\n    open(a) as x,\n    open(b) as y,\n):', ['target:x', 'target:y']],
    ['except (KeyError, ValueError) as err:', ['target:err']],
    ['except* OSError as group:', ['target:group']],
    ['while chunk := read():', ['target:chunk']],
    ['case Point(x=0, y=yy) | [a, *rest] if a > 0:', ['target:yy', 'target:a', 'target:rest']],
    ['case {"k": v, **others}:', ['target:v', 'target:others']],
    ['case Color.RED | None | _:', []],
    ['case str() as s:', ['target:s']]
  ])('%s', (source, expected) => {
    const parsed = parse(`${source}\n`)
    expect(summary(parsed.facts.bindings)).toEqual(expected)
    expect(parsed.opensBlock).toBe(true)
    expectOffsetsMatch(source, parsed.facts.bindings)
  })

  it('keeps `with ... as self.x` as an attribute', () => {
    const parsed = parse('with ctx() as self.resource:\n')
    expect(parsed.facts.attributes.map((a) => a.binding.name)).toEqual(['resource'])
  })

  it('parses a same-line body after a header', () => {
    const parsed = parse('if ready: value = 1; other = 2\n')
    expect(summary(parsed.facts.bindings)).toEqual(['assignment:value', 'assignment:other'])
    expect(parsed.opensBlock).toBe(false)
  })

  it('opens blocks for else/try/finally/match', () => {
    expect(parse('else:\n').opensBlock).toBe(true)
    expect(parse('try:\n').opensBlock).toBe(true)
    expect(parse('finally:\n').opensBlock).toBe(true)
    expect(parse('match command.split():\n').opensBlock).toBe(true)
  })
})

describe('parsePythonLine: imports', () => {
  it('binds the top package of a plain dotted import', () => {
    const parsed = parse('import os.path, json\n')
    expect(parsed.facts.bindings.map((b) => [b.name, b.importSource])).toEqual([
      ['os', { kind: 'module', module: 'os' }],
      ['json', { kind: 'module', module: 'json' }]
    ])
    expect(parsed.facts.moduleReferences[0].segments.map((s) => s.name)).toEqual(['os', 'path'])
  })

  it('binds an alias to the full dotted module', () => {
    const parsed = parse('import pkg.sub as s\n')
    expect(parsed.facts.bindings.map((b) => [b.name, b.importSource])).toEqual([
      ['s', { kind: 'module', module: 'pkg.sub' }]
    ])
  })

  it('reads multi-line parenthesized relative from-imports with aliases', () => {
    const source = 'from ..pkg.mod import (\n    a,  # first\n    b as c,\n)\n'
    const parsed = parse(source)
    expect(parsed.facts.bindings.map((b) => [b.name, b.importSource])).toEqual([
      ['a', { kind: 'from', level: 2, module: 'pkg.mod', name: 'a' }],
      ['c', { kind: 'from', level: 2, module: 'pkg.mod', name: 'b' }]
    ])
    const [reference] = parsed.facts.moduleReferences
    expect(reference.level).toBe(2)
    expect(reference.segments.map((s) => s.name)).toEqual(['pkg', 'mod'])
    expect(reference.importedNames.map((s) => s.name)).toEqual(['a', 'b'])
    expectOffsetsMatch(source, parsed.facts.bindings)
  })

  it('counts every dot of a relative import level', () => {
    expect(parse('from ... import x\n').facts.bindings[0].importSource).toEqual({
      kind: 'from',
      level: 3,
      module: '',
      name: 'x'
    })
    expect(parse('from .... import y\n').facts.bindings[0].importSource).toMatchObject({
      level: 4
    })
  })

  it('records star imports instead of bindings', () => {
    const parsed = parse('from .helpers import *\n')
    expect(parsed.facts.bindings).toEqual([])
    expect(parsed.facts.starImports).toEqual([{ level: 1, module: 'helpers' }])
  })

  it('records the module path of an unfinished from-import', () => {
    const parsed = parse('from pkg.mod\n')
    expect(parsed.facts.moduleReferences[0].segments.map((s) => s.name)).toEqual(['pkg', 'mod'])
  })
})

describe('parsePythonExpressionLocals', () => {
  function locals(source: string): string[] {
    const scan = scanPythonSource(source)
    const line = scan.lines[0]
    return summary(parsePythonExpressionLocals(scan.code, line.start, line.end, 0))
  }

  it('reads lambda parameters', () => {
    expect(locals('result = sorted(items, key=lambda item, *rest: item.name)\n')).toEqual([
      'parameter:item',
      'parameter:rest'
    ])
  })

  it('reads comprehension targets but not statement-level for targets', () => {
    expect(locals('pairs = [x for x, y in values if x]\n')).toEqual(['target:x', 'target:y'])
    expect(locals('d = {k: v for k, v in items()}\n')).toEqual(['target:k', 'target:v'])
    expect(locals('for a in b:\n')).toEqual([])
  })
})
