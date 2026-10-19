import { describe, expect, it } from 'vitest'
import {
  pythonReceiverBefore,
  resolvePythonReference,
  type PythonReferenceResolution
} from './python-definition-lookup'
import { parsePythonSyntaxTree } from './python-syntax-tree'

/** Offset of the `^` inside `pattern` (the marker itself is not part of the searched text). */
function markerOffset(source: string, pattern: string, occurrence = 0): number {
  const marker = pattern.indexOf('^')
  const needle = pattern.replace('^', '')
  let index = -1
  for (let i = 0; i <= occurrence; i++) {
    index = source.indexOf(needle, index + 1)
    if (index === -1) {
      throw new Error(`pattern not found: ${pattern} (#${occurrence})`)
    }
  }
  return index + marker
}

function resolveAt(source: string, cursor: string, occurrence = 0): PythonReferenceResolution {
  const tree = parsePythonSyntaxTree(source)
  const offset = markerOffset(source, cursor, occurrence)
  const name = /^[A-Za-z_]\w*/.exec(source.slice(offset))?.[0] ?? ''
  return resolvePythonReference(tree, name, offset)
}

function expectLocal(
  source: string,
  cursor: string,
  target: string,
  occurrences: { cursor?: number; target?: number } = {}
): void {
  const resolution = resolveAt(source, cursor, occurrences.cursor)
  expect(resolution.kind).toBe('local')
  if (resolution.kind === 'local') {
    expect(resolution.binding.offset).toBe(markerOffset(source, target, occurrences.target))
  }
}

function importedHops(resolution: PythonReferenceResolution): string[] {
  expect(resolution.kind).toBe('imported')
  return resolution.kind === 'imported'
    ? resolution.hops.map(
        (hop) =>
          `${hop.binding.name}${hop.path.map((part) => `.${part}`).join('')}${hop.viaBaseClass ? ' (base)' : ''}`
      )
    : []
}

describe('python name scopes', () => {
  const source = `x = 1

class A:
    x = 2
    y = x

    def m(self):
        return x

    def n(self):
        x = 3
        def inner():
            return x
        return inner
`

  it('lets a class body see its own names', () => {
    expectLocal(source, 'y = ^x', '    ^x = 2')
  })

  it('skips the class scope for functions defined in it', () => {
    expectLocal(source, 'return ^x\n\n', '^x = 1')
  })

  it('resolves free names to enclosing function scopes', () => {
    expectLocal(source, 'return ^x\n        return inner', '        ^x = 3')
  })

  it('honours global and nonlocal declarations', () => {
    const declarations = `counter = 0
def bump():
    global counter
    counter = counter + 1

def outer():
    total = 0
    def add():
        nonlocal total
        total += 1
`
    expectLocal(declarations, '^counter + 1', '^counter = 0')
    expectLocal(declarations, '^total += 1', '    ^total = 0')
  })

  it('lets parameters shadow module names', () => {
    const shadow = 'value = 1\ndef f(value):\n    return value\n'
    expectLocal(shadow, 'return ^value', 'def f(^value')
  })

  it('prefers the nearest binding before the cursor line, then the first one', () => {
    const rebinding = 'item = make()\nuse(item)\nitem = other()\nuse(item)\n'
    expectLocal(rebinding, 'use(^item)', '^item = make', { cursor: 0 })
    expectLocal(rebinding, 'use(^item)', '^item = other', { cursor: 1 })
    expectLocal('def early():\n    return later()\ndef later(): ...\n', '^later()', 'def ^later')
  })

  it('ignores augmented assignments when a plain binding exists', () => {
    expectLocal('n = 0\nn += 1\nprint(n)\n', 'print(^n)', '^n = 0')
  })

  it('returns the binding itself when the cursor is on it', () => {
    expectLocal('a = 1\na = 2\n', '^a = 2', '^a = 2')
    expectLocal('def f(): ...\n', 'def ^f', 'def ^f')
  })

  it('resolves loop, with, except, walrus, comprehension and lambda targets', () => {
    const targets = `for idx, val in pairs:
    print(val)
with open(p) as handle:
    handle.read()
try:
    pass
except Exception as err:
    log(err)
if (match := find()) is not None:
    use(match)
squares = [n * n for n in range(3)]
key = lambda row: row.id
`
    expectLocal(targets, 'print(^val)', 'idx, ^val')
    expectLocal(targets, '^handle.read', 'as ^handle')
    expectLocal(targets, 'log(^err)', 'as ^err')
    expectLocal(targets, 'use(^match)', '(^match :=')
    expectLocal(targets, '[^n * n', 'for ^n in')
    expectLocal(targets, '^row.id', 'lambda ^row')
  })

  it('reports unknown names as unresolved bare names', () => {
    expect(resolveAt('print(missing)\n', '^missing')).toEqual({
      kind: 'unresolved',
      attribute: false
    })
  })

  it('returns import bindings as hops', () => {
    expect(importedHops(resolveAt('from pkg import thing as t\nt()\n', '^t()'))).toEqual(['t'])
  })
})

describe('python attribute lookup', () => {
  const source = `class Base:
    shared = 1
    def greet(self): ...

class Child(Base):
    LIMIT = 3
    def __init__(self):
        self.name = "x"
        self.count = 0

    def reset(self):
        self.count += 1
        self.extra = 1

    def run(self):
        self.name
        self.count
        self.extra
        self.LIMIT
        self.run
        self.greet
        self.shared
        super().greet()
        super().run
        Child.LIMIT
        def nested():
            return self.name

    @classmethod
    def make(cls):
        return cls.LIMIT
`

  it('resolves self attributes from __init__ first, ignoring augmented assignments', () => {
    expectLocal(source, '        self.^name\n', 'self.^name = "x"')
    expectLocal(source, '        self.^count\n', 'self.^count = 0')
    expectLocal(source, '        self.^extra\n', 'self.^extra = 1')
  })

  it('resolves class-level names and methods through self, cls and the class name', () => {
    expectLocal(source, 'self.^LIMIT', '^LIMIT = 3')
    expectLocal(source, 'self.^run', 'def ^run')
    expectLocal(source, 'cls.^LIMIT', '^LIMIT = 3')
    expectLocal(source, 'Child.^LIMIT', '^LIMIT = 3')
  })

  it('walks in-file base classes, and super() looks at bases only', () => {
    expectLocal(source, 'self.^greet', 'def ^greet')
    expectLocal(source, 'self.^shared', '^shared = 1')
    expectLocal(source, 'super().^greet', 'def ^greet')
    expect(resolveAt(source, 'super().^run')).toEqual({ kind: 'unresolved', attribute: true })
  })

  it('follows self into closures inside methods', () => {
    expectLocal(source, 'return self.^name', 'self.^name = "x"')
  })

  it('hands imported base classes back as hops, in base order', () => {
    const imported = `from .models import Model
import framework.core
class Local:
    pass
class Mine(Model, framework.core.Base, Local):
    def go(self):
        self.save()
`
    expect(importedHops(resolveAt(imported, 'self.^save'))).toEqual([
      'Model.save (base)',
      'framework.core.Base.save (base)'
    ])
  })

  it('hands module aliases back as hops with the attribute path', () => {
    const modules = 'import pkg.mod as m\nimport os.path\nm.func()\nos.path.join(a)\n'
    expect(importedHops(resolveAt(modules, 'm.^func'))).toEqual(['m.func'])
    expect(importedHops(resolveAt(modules, 'os.path.^join'))).toEqual(['os.path.join'])
  })

  it('resolves nested class paths', () => {
    const nested = 'class Outer:\n    class Inner:\n        value = 1\nOuter.Inner.value\n'
    expectLocal(nested, 'Inner.^value', '        ^value = 1')
  })

  it('leaves calls, subscripts and plain variables unresolved', () => {
    const unknown = 'obj = make()\nget().x\nitems[0].y\nobj.z\n'
    for (const cursor of ['get().^x', 'items[0].^y', 'obj.^z']) {
      expect(resolveAt(unknown, cursor)).toEqual({ kind: 'unresolved', attribute: true })
    }
  })
})

describe('pythonReceiverBefore', () => {
  it('reads dotted chains across whitespace and newlines', () => {
    const code = 'a.b.c\nf(x .\n  y)\n'
    expect(pythonReceiverBefore(code, code.indexOf('c'))).toEqual({
      kind: 'names',
      names: [
        { name: 'a', offset: 0 },
        { name: 'b', offset: 2 }
      ]
    })
    expect(pythonReceiverBefore(code, code.indexOf('y'))).toEqual({
      kind: 'names',
      names: [{ name: 'x', offset: code.indexOf('x') }]
    })
    expect(pythonReceiverBefore(code, 0)).toBeNull()
  })

  it('recognizes super() calls, with or without arguments', () => {
    expect(pythonReceiverBefore('super().x', 8)).toEqual({ kind: 'super' })
    expect(pythonReceiverBefore('super(A, self).x', 15)).toEqual({ kind: 'super' })
    expect(pythonReceiverBefore('not_super().x', 12)).toEqual({ kind: 'expression' })
  })
})
